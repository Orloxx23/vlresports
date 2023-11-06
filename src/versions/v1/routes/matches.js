const { Router } = require("express");
const router = Router();
const matchesController = require("../../../controllers/matchesController");

router.get("/", matchesController.getMatches);

module.exports = router;
