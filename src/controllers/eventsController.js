const eventsService = require("../services/eventsService");
const catchError = require("../utils/catchError");
const { normalizeTheme } = require("../utils/vlrSession");

const getEvents = async (req, res) => {
  const status = req.query.status || "all";
  const page = parseInt(req.query.page) || 1;
  const tier = req.query.tier || null;

  const region = req.query.region || "all";
  const theme = normalizeTheme(req.query.theme);

  try {
    const { size, events } = await eventsService.getEvents(
      status,
      region,
      tier,
      page,
      theme
    );

    res.status(200).json({
      status: "OK",
      size,
      data: events,
    });
  } catch (error) {
    catchError(res, error);
  }
};

const getEventById = async (req, res) => {
  const { id } = req.params;
  const theme = normalizeTheme(req.query.theme);

  if (!/^\d+$/.test(id)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid event id",
      },
    });
    return;
  }

  const stage = req.query.stage || null;
  if (stage && !/^[a-z0-9-]+$/i.test(stage)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid stage: must be a stage slug (e.g. playoffs)",
      },
    });
    return;
  }

  try {
    const event = await eventsService.getEventById(id, theme, stage);

    res.status(200).json({
      status: "OK",
      data: event,
    });
  } catch (error) {
    if (error.validStages) {
      res.status(400).json({
        status: "error",
        message: {
          error: 400,
          message: `Stage not found. Valid stages: ${error.validStages.join(
            ", "
          )}`,
        },
      });
      return;
    }
    catchError(res, error);
  }
};

const validateEventId = (id, res) => {
  if (!/^\d+$/.test(id)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid event id",
      },
    });
    return false;
  }
  return true;
};

const validateStage = (stage, res) => {
  if (stage && !/^[a-z0-9-]+$/i.test(stage)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: "Invalid stage: must be a stage slug (e.g. playoffs)",
      },
    });
    return false;
  }
  return true;
};

const handleEventError = (res, error) => {
  if (error.validStages) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: `Stage not found. Valid stages: ${error.validStages.join(
          ", "
        )}`,
      },
    });
    return;
  }
  catchError(res, error);
};

const MATCH_STATUSES = ["all", "upcoming", "live", "completed"];

const getEventMatches = async (req, res) => {
  const { id } = req.params;
  const theme = normalizeTheme(req.query.theme);
  const stage = req.query.stage || null;
  const status = (req.query.status || "all").toLowerCase();

  if (!validateEventId(id, res) || !validateStage(stage, res)) return;

  if (!MATCH_STATUSES.includes(status)) {
    res.status(400).json({
      status: "error",
      message: {
        error: 400,
        message: `Invalid status. Valid values: ${MATCH_STATUSES.join(", ")}`,
      },
    });
    return;
  }

  try {
    const result = await eventsService.getEventMatches(id, theme, {
      stage,
      status,
    });

    res.status(200).json({
      status: "OK",
      stage: result.stage,
      matchStatus: result.status,
      stages: result.stages,
      size: result.size,
      data: result.matches,
    });
  } catch (error) {
    handleEventError(res, error);
  }
};

const getEventStats = async (req, res) => {
  const { id } = req.params;
  const theme = normalizeTheme(req.query.theme);
  const stage = req.query.stage || null;

  if (!validateEventId(id, res) || !validateStage(stage, res)) return;

  try {
    const result = await eventsService.getEventStats(id, theme, stage);

    res.status(200).json({
      status: "OK",
      stage: result.stage,
      size: result.size,
      data: result.players,
    });
  } catch (error) {
    handleEventError(res, error);
  }
};

const getEventAgents = async (req, res) => {
  const { id } = req.params;
  const theme = normalizeTheme(req.query.theme);

  if (!validateEventId(id, res)) return;

  try {
    const result = await eventsService.getEventAgents(id, theme);

    res.status(200).json({
      status: "OK",
      size: result.size,
      data: result.maps,
    });
  } catch (error) {
    handleEventError(res, error);
  }
};

module.exports = {
  getEvents,
  getEventById,
  getEventMatches,
  getEventStats,
  getEventAgents,
};
