const express = require("express");
const morgan = require("morgan");
let cors = require('cors')

const app = express();

// Settings
app.set("port", process.env.PORT || 5000);

// Middlewares
app.use(cors())
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Routes
app.use(require("./versions/v1/routes/index"));
app.use("/api", require("./versions/v1/routes/index"));
// - Version 1
app.use("/api/v1/teams", require("./versions/v1/routes/teams"));
app.use("/api/v1/players", require("./versions/v1/routes/players"));

// Starting server
app.listen(app.get("port"), () => {
  console.log(`Server running on port ${app.get("port")}`);
});
