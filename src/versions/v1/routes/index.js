const { Router } = require("express");
const router = new Router();

router.get("/", (req, res) => {
  const data = {
    name: "Orlando Mina (Orloxx)",
    website: "orlandomm.net",
  };
  res.json(data);
});

module.exports = router;
