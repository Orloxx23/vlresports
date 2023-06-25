const { Router } = require("express");
const router = Router();
const playersController = require("../../../controllers/playersController");

router.get("/", playersController.getPlayers);
router.get("/:id", playersController.getPlayerById);

module.exports = router;