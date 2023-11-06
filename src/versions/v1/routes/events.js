const { Router } = require("express");
const router = Router();
const eventsController = require("../../../controllers/eventsController");

router.get("/", eventsController.getEvents);
// router.get("/:id", playersController.getPlayerById);

module.exports = router;
