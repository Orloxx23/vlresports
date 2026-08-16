const { Router } = require("express");
const router = Router();
const matchesController = require("../../../controllers/matchesController");

router.get("/", matchesController.getMatches);
router.get("/:id", matchesController.getMatchById);

module.exports = router;
