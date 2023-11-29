const { Router } = require("express");
const router = new Router();

router.get("/", (req, res) => {
  const data = {
    contact: "orlandomm.net",
    documentation: "vlresports.vercel.app",
  };
  res.json(data);
});

module.exports = router;
