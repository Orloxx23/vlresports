const Sentry = require("./instrument");

// Process-level guards: report to GlitchTip and keep the service alive
// instead of letting Node kill the process.
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled rejection:", reason);
  Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception:", err);
  Sentry.captureException(err);
});

const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
let cors = require("cors");
const openApiSpec = require("./openapi.json");
const { startTeamsIndexRefresher } = require("./utils/teamLogos");
const { startEventLogosRefresher } = require("./utils/eventLogos");
const { startSessionRefresher, getScraperHealth } = require("./utils/vlrSession");

const app = express();

// Settings
app.set("port", process.env.PORT || 5000);

// When deployed behind a reverse proxy, trust it so rate limiting keys off the
// real client IP instead of the proxy's. Left off by default: enabling it
// without a proxy would let clients spoof X-Forwarded-For to dodge the limiter.
// Express takes a number as a hop count but parses any string as an IP/subnet
// list, so "1" from the environment must become the number 1 (as a string it
// means the address 0.0.0.1 and no proxy is ever trusted).
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY.trim();
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// API Documentation (loaded dynamically)
let scalarLoaded = false;
import("@scalar/express-api-reference").then(({ apiReference }) => {
  app.use(
    "/docs",
    apiReference({
      spec: {
        content: openApiSpec,
      },
    })
  );
  scalarLoaded = true;
  console.log("API Documentation loaded at /docs");
}).catch(err => {
  console.error("Failed to load API documentation:", err.message);
});

// Per-client admission control for the scraper-backed API. Every one of these
// routes funnels into a single, rate-limited request queue (see vlrSession.js),
// so without this a single unauthenticated client can flood the shared queue
// and degrade availability for everyone (CWE-770).
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: {
      error: 429,
      message: "Too many requests",
    },
  },
});

// Point an uptime monitor here. It never calls vlr.gg itself: it reports how
// the last real scraper requests went, so it answers 503 when vlr.gg or the
// proxy keeps failing even though the process itself is up.
app.get("/health", (req, res) => {
  const scraper = getScraperHealth();
  res.status(scraper.healthy ? 200 : 503).json({
    status: scraper.healthy ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    scraper,
  });
});

// Routes
app.use(require("./versions/v1/routes/index"));
app.use("/api", require("./versions/v1/routes/index"));
// - Version 1
app.use("/api/v1/teams", apiLimiter, require("./versions/v1/routes/teams"));
app.use("/api/v1/players", apiLimiter, require("./versions/v1/routes/players"));
app.use("/api/v1/events", apiLimiter, require("./versions/v1/routes/events"));
app.use("/api/v1/matches", apiLimiter, require("./versions/v1/routes/matches"));
app.use("/api/v1/results", apiLimiter, require("./versions/v1/routes/results"));

// GlitchTip: report unhandled route errors
Sentry.setupExpressErrorHandler(app);

// Final error handler: always answer with JSON instead of crashing the request
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: {
      error: err.statusCode || 500,
      message: "Internal server error",
    },
  });
});

// Starting server
app.listen(app.get("port"), () => {
  console.log(`Server running on port ${app.get("port")}`);
  console.log(`API Documentation will be available at http://localhost:${app.get("port")}/docs`);
  startSessionRefresher();
  startTeamsIndexRefresher();
  startEventLogosRefresher();
});
