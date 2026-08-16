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
  } catch (error) {
    catchError(res, error);
  }
};

const getMatchById = async (req, res) => {
  const { id } = req.params;
  const theme = normalizeTheme(req.query.theme);

  if (!/^\d+$/.test(id)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid match id",
      },
    });
    return;
  }

  // Optional extra tabs: ?tabs=performance,economy or ?tabs=all
  let tabs = [];
  if (req.query.tabs) {
    const requested = String(req.query.tabs)
      .split(",")
      .map((tab) => tab.trim().toLowerCase())
      .filter(Boolean);
    tabs = requested.includes("all")
      ? [...matchesService.MATCH_TABS]
      : requested;

    const invalid = tabs.filter(
      (tab) => !matchesService.MATCH_TABS.includes(tab)
    );
    if (invalid.length > 0) {
      res.status(400).json({
        status: "error",
        message: {
          error: 400,
          message: `Invalid tabs: ${invalid.join(", ")}. Valid values: ${[
            ...matchesService.MATCH_TABS,
            "all",
          ].join(", ")}`,
        },
      });
      return;
    }
  }

  try {
    const match = await matchesService.getMatchById(id, theme, tabs);
    res.status(200).json({
      status: "OK",
      data: match,
    });
  } catch (error) {
    catchError(res, error);
  }
};

module.exports = {
  getMatches,
  getMatchById,
};
