const { Router } = require("express");
const teamsController = require("../../../controllers/teamsController");
const router = Router();

// Endpoint to retrieve team information
router.get("/:id", teamsController.getTeam);

module.exports = router;
