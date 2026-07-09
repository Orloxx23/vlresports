// GlitchTip (Sentry SDK) — must be required before express so the
// SDK can auto-instrument http/express.
require("dotenv").config();

const Sentry = require("@sentry/node");

if (process.env.GLITCHTIP_DSN) {
  Sentry.init({
    dsn: process.env.GLITCHTIP_DSN,
    environment: process.env.NODE_ENV || "production",
    release: `vlresports@${require("../package.json").version}`,
  });
  console.log("GlitchTip error tracking enabled");
}

module.exports = Sentry;
