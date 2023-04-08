const express = require("express");
const morgan = require("morgan");
var cors = require('cors')

const app = express();

// Settings
app.set("port", process.env.PORT || 5000);

// Middlewares
app.use(cors())
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Routes
app.use(require("./routes/index"));
app.use("/api/team", require("./routes/team"));

// Starting server
app.listen(app.get("port"), () => {
  console.log(`Server running on port ${app.get("port")}`);
});
