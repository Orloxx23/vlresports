const teamsService = require("../services/teamsService");
const catchError = require("../utils/catchError");

const getTeam = async (req, res) => {
  const { id } = req.params;
  try {
    const team = await teamsService.getTeam(id);
    res.status(200).json({
      status: "OK",
      data: team,
    });
  } catch (error) {
    catchError(res, error);
  }
};

module.exports = {
  getTeam,
};
