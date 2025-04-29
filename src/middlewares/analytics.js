const { v4: uuidv4 } = require("uuid");
const geoip = require("geoip-lite");
const { pool } = require("../database/database");

function normalizeIp(ip) {
  if (!ip) return "unknown";
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

function isLocalOrPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "localhost" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  // 172.16.0.0 – 172.31.255.255
  const match = ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);
  if (match) return true;
  return false;
}

function enhancedAnalyticsMiddleware(req, res, next) {
  const startTime = Date.now();

  const originalPath = req.path;
  const originalMethod = req.method;
  const originalBody = req.body || {};
  const originalQuery = req.query || {};
  const userAgentString = req.headers["user-agent"] || "";
  const referer = req.headers.referer || "";
  const rawIp = req.ip || req.connection.remoteAddress;
  const ip = normalizeIp(rawIp);
  console.log("🚀 ~ enhancedAnalyticsMiddleware ~ ip:", ip)
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  let originDomain = "";
  try {
    if (referer) {
      const url = new URL(referer);
      originDomain = url.hostname;
    }
  } catch (e) {}

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    let version = "unknown";
    if (originalPath.includes("/v1/")) {
      version = "v1";
    }
    let geo = { country: "unknown", region: "unknown", city: "unknown" };
    if (isLocalOrPrivateIp(ip)) {
      geo = { country: "local", region: "local", city: "local" };
    } else {
      geo = geoip.lookup(ip) || geo;
    }
    let category = "other";
    if (originalPath.includes("/teams")) category = "teams";
    else if (originalPath.includes("/players")) category = "players";
    else if (originalPath.includes("/events")) category = "events";
    else if (originalPath.includes("/matches")) category = "matches";
    else if (originalPath.includes("/results")) category = "results";
    else if (originalPath.includes("/analytics")) category = "analytics";
    
    let isMobile = false;
    let isBot = false;
    if (userAgentString.toLowerCase().includes("postman")) {
      isBot = true;
    } else {
      isMobile = typeof req.useragent?.isMobile === "boolean" ? req.useragent.isMobile : false;
      isBot = typeof req.useragent?.isBot === "boolean" ? req.useragent.isBot : false;
    }
    const browser = (req.useragent && req.useragent.browser) || "unknown";
    const browserVersion = (req.useragent && req.useragent.version) || "unknown";
    const os = (req.useragent && req.useragent.os) || "unknown";
    const platform = (req.useragent && req.useragent.platform) || "unknown";
    
    const contentLength = res.getHeader('Content-Length') ? parseInt(res.getHeader('Content-Length')) : 0;
    const analyticsData = {
      id: uuidv4(),
      method: originalMethod,
      path: originalPath,
      status_code: res.statusCode,
      response_time_ms: responseTime,
      response_size: contentLength,
      user_agent: userAgentString,
      ip_address: ip,
      request_body: originalBody,
      query_params: originalQuery,
      version: version,
      referrer: referer,
      origin: origin,
      host: host,
      browser: browser,
      browser_version: browserVersion,
      os: os,
      platform: platform,
      is_mobile: isMobile,
      is_bot: isBot,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      origin_domain: originDomain,
      request_headers: req.headers,
      endpoint_category: category,
    };
    (async () => {
      try {
        await pool.query(
          `
            INSERT INTO api_requests 
            (id, method, path, status_code, response_time_ms, user_agent, ip_address, 
             request_body, query_params, version, referrer, origin, host, browser, browser_version, 
             os, platform, is_mobile, is_bot, country, region, city, origin_domain, 
             request_headers, response_size, endpoint_category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                    $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          `,
          [
            analyticsData.id,
            analyticsData.method,
            analyticsData.path,
            analyticsData.status_code,
            analyticsData.response_time_ms,
            analyticsData.user_agent,
            analyticsData.ip_address,
            JSON.stringify(analyticsData.request_body),
            JSON.stringify(analyticsData.query_params),
            analyticsData.version,
            analyticsData.referrer,
            analyticsData.origin,
            analyticsData.host,
            analyticsData.browser,
            analyticsData.browser_version,
            analyticsData.os,
            analyticsData.platform,
            analyticsData.is_mobile,
            analyticsData.is_bot,
            analyticsData.country,
            analyticsData.region,
            analyticsData.city,
            analyticsData.origin_domain,
            JSON.stringify(analyticsData.request_headers),
            analyticsData.response_size,
            analyticsData.endpoint_category,
          ]
        );
        console.log(
          `Analytics saved for: ${analyticsData.method} ${analyticsData.path}`
        );
      } catch (err) {
        console.error("Error saving analytics data:", err);
      }
    })();
  });
  next();
}

module.exports = enhancedAnalyticsMiddleware;
