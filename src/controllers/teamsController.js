const teamsService = require("../services/teamsService");
const catchError = require("../utils/catchError");

const getTeams = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = req.query.limit || 10;
  const pagination = {
    page,
    limit,
  };

  const regionAvailable = [
    "na",
    "north-america",
    "eu",
    "europe",
    "br",
    "brazil",
    "ap",
    "asia-pacific",
    "asia",
    "pacific",
    "kr",
    "korea",
    "ch",
    "china",
    "jp",
    "japan",
    "las",
    "la-s",
    "lan",
    "la-n",
    "oce",
    "oceania",
    "mena",
    "gc",
    "world",
    "all",
  ];

  const regionQuery = req.query.region || "all";

  if (!regionAvailable.includes(regionQuery)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid region",
      },
    });
    return;
  }

  let region;
  switch (regionQuery) {
    case "na":
      region = "north-america";
      break;
    case "eu":
      region = "europe";
      break;
    case "br":
      region = "brazil";
      break;
    case "ap":
      region = "asia-pacific";
      break;
    case "asia":
      region = "asia-pacific";
      break;
    case "pacific":
      region = "asia-pacific";
      break;
    case "kr":
      region = "korea";
      break;
    case "ch":
      region = "china";
      break;
    case "jp":
      region = "japan";
      break;
    case "las":
      region = "la-s";
      break;
    case "lan":
      region = "la-n";
      break;
    case "oce":
      region = "oceania";
      break;
    case "mena":
      region = "mena";
      break;
    case "gc":
      region = "gc";
      break;
    case "world":
      region = "all";
      break;
    case "all":
      region = "all";
      break;
    default:
      region = regionQuery;
  }

  try {
    const {
      teams,
      pagination: { totalElements, totalPages, hasNextPage },
    } = await teamsService.getTeams(pagination, region);

    res.json({
      status: "OK",
      region,
      size: teams.length,
      pagination: {
        page,
        limit,
        totalElements,
        totalPages,
        hasNextPage,
      },
      data: teams,
    });
  } catch (error) {
    catchError(res, error);
  }
};

const getTeamById = async (req, res) => {
  const { id } = req.params;
  try {
    const team = await teamsService.getTeamById(id);
    res.status(200).json({
      status: "OK",
      data: team,
    });
  } catch (error) {
    catchError(res, error);
  }
};

module.exports = {
  getTeams,
  getTeamById,
};
