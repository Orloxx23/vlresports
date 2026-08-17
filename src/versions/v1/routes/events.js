const { Router } = require("express");
const router = Router();
const eventsController = require("../../../controllers/eventsController");

router.get("/", eventsController.getEvents);
router.get("/:id", eventsController.getEventById);
router.get("/:id/matches", eventsController.getEventMatches);
router.get("/:id/stats", eventsController.getEventStats);
router.get("/:id/agents", eventsController.getEventAgents);

module.exports = router;
