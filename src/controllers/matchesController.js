const matchesService = require("../services/matchesService");
const catchError = require("../utils/catchError");
const { normalizeTheme } = require("../utils/vlrSession");

const getMatches = async (req, res) => {
  const theme = normalizeTheme(req.query.theme);
  try {
    const { size, matches } = await matchesService.getMatches(theme);

    res.status(200).json({
      status: "OK",
      size,
      data: matches,
    });
  } catch (error) {}
};

module.exports = {
  getMatches,
};
