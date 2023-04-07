const { Router } = require("express");
const router = new Router();

router.get("/", (req, res) => {
  const data = {
    name: "Orlando Mina",
    website: "orlandomm.vercel.app",
  };
  res.json(data);
});

module.exports = router;
