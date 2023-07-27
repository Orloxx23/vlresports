const { Router } = require("express");
const router = Router();
const teamsController = require("../../../controllers/teamsController");

router.get("/", teamsController.getTeams);
router.get("/:id", teamsController.getTeamById);

module.exports = router;
