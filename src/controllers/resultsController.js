const resultsService = require("../services/resultsService");
const catchError = require("../utils/catchError");

const getResults = async (req, res) => {
  const page = req.query.page || 1;
  try {
    const { size, results } = await resultsService.getResults(page);

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
