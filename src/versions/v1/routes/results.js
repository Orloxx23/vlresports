const { Router } = require("express");
const router = Router();
const resultsController = require("../../../controllers/resultsController");

router.get("/", resultsController.getResults);

module.exports = router;
