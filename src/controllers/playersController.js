const playersService = require("../services/playersService");
const catchError = require("../utils/catchError");

const getPlayers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = req.query.limit || 10;
  const pagination = {
    page,
    limit,
  };

  const event_series = req.query.event_series || "all";
  const event = req.query.event || "all";
  const country = req.query.country || "all";
  const region = req.query.regions || "all";
  const minrounds = req.query.minrounds || 200;
  const minrating = req.query.minrating || 1550;
  const agent = req.query.agent || "all";
  const map = req.query.map_id || "all";
  const timespan = req.query.timespan || "60d";

  const filters = {
    event_series,
    event,
    country,
    region,
    minrounds,
    minrating,
    agent,
    map,
    timespan,
  };

  try {
    const {
      players,
      pagination: { totalElements, totalPages, hasNextPage },
    } = await playersService.getPlayers(pagination, filters);
    res.json({
      status: "OK",
      size: players.length,
      pagination: {
        page,
        limit,
        totalElements,
        totalPages,
        hasNextPage,
      },
      data: players,
    });
  } catch (error) {
    catchError(res, error);
  }
};

const getPlayerById = async (req, res) => {
  // To do - Implement this function
  const { id } = req.params;
  try {
    const player = await playersService.getPlayerById(id);
    res.json({
      status: "OK",
      data: player,
    });
  } catch (error) {
    catchError(res, error);
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
};
