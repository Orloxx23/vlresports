const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");
const { enrichMatchesWithTeamLogos } = require("../utils/teamLogos");
const { applyEventLogosToMatches } = require("../utils/eventLogos");
const { vlrGet } = require("../utils/vlrSession");

async function getResults(page, theme) {
  const { data } = await vlrGet(`${vlrgg_url}/matches/results?page=${page}`, theme);
  const $ = cheerio.load(data);

  const results = [];

  $(".wf-module-item.match-item").each((index, element) => {
    const match = {};
    match.id = $(element).attr("href").split("/")[1];
    match.teams = [];
    $(element)
      .find(".match-item-vs-team")
      .each((index, teamElement) => {
        const team = {};
        team.name = $(teamElement).find(".text-of").text().trim();
        team.score = $(teamElement)
          .find(".match-item-vs-team-score")
          .text()
          .trim();
        team.country = $(teamElement)
          .find(".flag")
          .attr("class")
          .split(" ")[1]
          .replace("mod-", "");
        team.won = $(teamElement).hasClass("mod-winner");
        match.teams.push(team);
      });
    // Fall back to comparing scores if vlr.gg didn't flag a winner
    const scores = match.teams.map((team) => Number(team.score));
    if (
      !match.teams.some((team) => team.won) &&
      match.teams.every((team) => team.score !== "") &&
      scores.every(Number.isFinite)
    ) {
      const winningScore = Math.max(...scores);
      match.teams.forEach((team, i) => {
        team.won = scores[i] === winningScore;
      });
    }
    match.status = $(element).find(".ml-status").text().trim();
    match.ago = $(element).find(".ml-eta").text().trim();
    match.event = $(element)
      .find(".match-item-event-series.text-of")
      .text()
      .trim();
    match.tournament = $(element)
      .find(".match-item-event.text-of")
      .contents()
      .last()
      .text()
      .trim();
    match.img = $(element)
      .find(".match-item-icon img")
      .attr("src")
      .includes("/img/vlr")
      ? vlrgg_url + $(element).find(".match-item-icon img").attr("src")
      : "https:" + $(element).find(".match-item-icon img").attr("src");

    results.push(match);
  });

  await Promise.all([
    enrichMatchesWithTeamLogos(results, theme),
    applyEventLogosToMatches(results, theme),
  ]);

  return {
    size: results.length,
    results,
  };
}

module.exports = {
  getResults,
};
