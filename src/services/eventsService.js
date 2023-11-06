const request = require("request-promise");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");

/**
 * Retrieves and parses event data based on the provided status, region, and page number from a specified URL using cheerio and request modules.
 * @param {string} status - The status of the events to filter ("all", "upcoming", "live", "completed").
 * @param {string} region - The region of the events to filter (e.g., "na", "eu").
 * @param {number} page - The page number of the events to retrieve (default is 1).
 * @returns {Object} An object containing event details including event name, status, prize pool, dates, region, and event image URL.
 */
async function getEvents(status, region, page) {
  // Send a request to the specified URL with the provided region and page number, then parse the HTML response using cheerio
  const $ = await request({
    uri: `${vlrgg_url}/events/${region}?page=${page}`,
    transform: (body) => cheerio.load(body),
  });

  // Array to store event objects
  const events = [];

  // Iterate over each event item on the page and extract relevant information
  $(".event-item").each((index, element) => {
    // Extract event ID, name, and status
    const href = $(element).attr("href");
    const id = href.match(/\/event\/(\d+)\//)[1];
    const name = $(element).find(".event-item-title").text().trim();
    const eventStatus = $(element)
      .find(".event-item-desc-item-status")
      .text()
      .trim();

    // Check if the event status matches the provided status or if status is "all"
    if (status === "all" || eventStatus === status) {
      // Extract prize pool, dates, region, and event image URL
      const prizepoolText = $(element)
        .find(".event-item-desc-item.mod-prize")
        .text()
        .trim();
      const prizepool = prizepoolText.replace(/\D/g, "");
      const datesText = $(element)
        .find(".event-item-desc-item.mod-dates")
        .text()
        .trim();
      const dates = datesText
        .match(/[a-zA-Z]+|\d+/g)
        .join(" ")
        .replace(" Dates", "");
      const region = $(element)
        .find(".event-item-desc-item.mod-location .flag")
        .attr("class")
        .split(" ")[1]
        .replace("mod-", "");
      const img = $(element)
        .find(".event-item-thumb img")
        .attr("src")
        .includes("/img/vlr")
        ? vlrgg_url + $(element).find(".event-item-thumb img").attr("src")
        : "https:" + $(element).find(".event-item-thumb img").attr("src");

      // Create event object and push it to the events array
      events.push({
        id,
        name,
        status: eventStatus,
        prizepool,
        dates,
        region,
        img,
      });
    }
  });

  // Return an object containing the list of events and the number of events in the list
  return {
    events: events,
    size: events.length,
  };
}

async function getEventById(id) {
  /* TODO */
}

module.exports = {
  getEvents,
};
