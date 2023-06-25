const { Router } = require("express");
const router = Router();
const teamsController = require("../../../controllers/teamsController");

// Endpoint to retrieve team information
router.get("/:id", teamsController.getTeam);

module.exports = router;
