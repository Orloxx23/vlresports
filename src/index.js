const express = require("express");
const morgan = require("morgan");
let cors = require("cors");
const useragent = require("express-useragent"); // npm install express-useragent
const { initializeDatabase } = require("./database/database");
const enhancedAnalyticsMiddleware = require("./middlewares/analytics");

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
});
