const resultsService = require("../services/resultsService");
const catchError = require("../utils/catchError");
const { normalizeTheme } = require("../utils/vlrSession");

const getResults = async (req, res) => {
  const page = req.query.page || 1;
  const theme = normalizeTheme(req.query.theme);
  try {
    const { size, results } = await resultsService.getResults(page, theme);

    res.status(200).json({
      status: "OK",
      size,
      data: results,
    });
  } catch (error) {}
};

module.exports = {
  getResults,
};
