const matchesService = require("../services/matchesService");
const catchError = require("../utils/catchError");

const getMatches = async (req, res) => {
  try {
    const { size, matches } = await matchesService.getMatches();

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
