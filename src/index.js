const express = require("express");
const morgan = require("morgan");
let cors = require("cors");
const useragent = require("express-useragent");
const { initializeDatabase } = require("./database/database");
const enhancedAnalyticsMiddleware = require("./middlewares/analytics");
const openApiSpec = require("./openapi.json");

const app = express();

// Settings
app.set("port", process.env.PORT || 5000);

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(enhancedAnalyticsMiddleware);
app.use(useragent.express());
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

// Routes
app.use(require("./versions/v1/routes/index"));
app.use("/api", require("./versions/v1/routes/index"));
// - Version 1
app.use("/api/v1/teams", require("./versions/v1/routes/teams"));
app.use("/api/v1/players", require("./versions/v1/routes/players"));
app.use("/api/v1/events", require("./versions/v1/routes/events"));
app.use("/api/v1/matches", require("./versions/v1/routes/matches"));
app.use("/api/v1/results", require("./versions/v1/routes/results"));

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((err) => {
    console.error("Error initializing database:", err);
  });

// Starting server
app.listen(app.get("port"), () => {
  console.log(`Server running on port ${app.get("port")}`);
  console.log(`API Documentation will be available at http://localhost:${app.get("port")}/docs`);
});
