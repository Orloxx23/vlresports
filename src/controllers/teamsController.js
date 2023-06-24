const teamsService = require("../services/teamsService");

const getTeam = async (req, res) => {
  const { id } = req.params;
  try {
    const team = await teamsService.getTeam(id);
    res.json({
      status: "OK",
      data: team,
    });
  } catch (error) {
    res.json({
      status: "error",
      message: error,
    });
  }
};

module.exports = {
  getTeam,
}
