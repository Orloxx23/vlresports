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
  } catch (error) {}
};

// To do: Add getEventById
/*const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await eventsService.getEventById(id);

    res.status(200).json({
      status: "OK",
      data: event,
    });
  } catch (error) {}
};*/

module.exports = {
  getEvents,
};
