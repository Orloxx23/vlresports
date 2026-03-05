const { Router } = require("express");
const router = new Router();

router.get("/", (req, res) => {
  const data = {
    contact: "orlandomm.net",
    documentation: "vlr.orlandomm.net/docs",
  };
  res.json(data);
});

module.exports = router;
