const { v4: uuidv4 } = require("uuid");
const geoip = require("geoip-lite"); // npm install geoip-lite
const { pool } = require("../database/database");

function enhancedAnalyticsMiddleware(req, res, next) {
  const startTime = Date.now();

  // Save the original send function
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Function to store analytics data
  const saveAnalytics = (responseBody, contentLength) => {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Identify API version from the route
    let version = "unknown";
    if (req.path.includes("/v1/")) {
      version = "v1";
    }

    // Get location information based on IP
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip) || {
      country: "unknown",
      region: "unknown",
      city: "unknown",
    };

    // Categorize the endpoint based on the path
    let category = "other";
    if (req.path.includes("/teams")) category = "teams";
    else if (req.path.includes("/players")) category = "players";
    else if (req.path.includes("/events")) category = "events";
    else if (req.path.includes("/matches")) category = "matches";
    else if (req.path.includes("/results")) category = "results";
    else if (req.path.includes("/analytics")) category = "analytics";

    // Extract origin domain from referrer
    const referer = req.headers.referer || "";
    let originDomain = "";
    try {
      if (referer) {
        const url = new URL(referer);
        originDomain = url.hostname;
      }
    } catch (e) {
      // If URL parsing fails, leave originDomain empty
    }

    // Ensure boolean fields are actual booleans
    // This is the main fix for the Postman error
    let isMobile = false;
    let isBot = false;

    // Check User-Agent to detect Postman
    const userAgentString = req.headers["user-agent"] || "";

    // Specifically detect Postman
    if (userAgentString.toLowerCase().includes("postman")) {
      isBot = true; // Consider Postman as a bot
    } else {
      // Use useragent values if available and boolean
      isMobile =
        typeof req.useragent.isMobile === "boolean"
          ? req.useragent.isMobile
          : false;
      isBot =
        typeof req.useragent.isBot === "boolean" ? req.useragent.isBot : false;
    }

    // Safely extract browser information
    const browser = (req.useragent && req.useragent.browser) || "unknown";
    const browserVersion =
      (req.useragent && req.useragent.version) || "unknown";
    const os = (req.useragent && req.useragent.os) || "unknown";
    const platform = (req.useragent && req.useragent.platform) || "unknown";

    // Collect request data with extended information
    const analyticsData = {
      id: uuidv4(),
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      response_time_ms: responseTime,
      response_size: contentLength || 0,
      user_agent: userAgentString,
      ip_address: ip,
      request_body: req.body || {},
      query_params: req.query || {},
      version: version,

      // Detailed information (corrected)
      referrer: referer,
      browser: browser,
      browser_version: browserVersion,
      os: os,
      platform: platform,
      is_mobile: isMobile, // Now guaranteed to be boolean
      is_bot: isBot, // Now guaranteed to be boolean
      country: geo.country,
      region: geo.region,
      city: geo.city,
      origin_domain: originDomain,
      request_headers: req.headers,
      endpoint_category: category,
    };

    // Store data in the database asynchronously
    (async () => {
      try {
        await pool.query(
          `
            INSERT INTO api_requests 
            (id, method, path, status_code, response_time_ms, user_agent, ip_address, 
             request_body, query_params, version, referrer, browser, browser_version, 
             os, platform, is_mobile, is_bot, country, region, city, origin_domain, 
             request_headers, response_size, endpoint_category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                    $16, $17, $18, $19, $20, $21, $22, $23, $24)
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
  };

  // Replace the original send function
  res.send = function (body) {
    let contentLength = 0;
    if (body) {
      contentLength = Buffer.isBuffer(body)
        ? body.length
        : Buffer.byteLength(String(body));
    }
    saveAnalytics(body, contentLength);
    return originalSend.apply(res, arguments);
  };

  // Also override json to capture JSON responses
  res.json = function (body) {
    const json = JSON.stringify(body);
    const contentLength = Buffer.byteLength(json);
    saveAnalytics(body, contentLength);
    return originalJson.apply(res, arguments);
  };

  // Override end to capture other response types
  res.end = function (chunk, encoding) {
    let contentLength = 0;
    if (chunk) {
      contentLength = Buffer.isBuffer(chunk)
        ? chunk.length
        : Buffer.byteLength(String(chunk));
    }
    saveAnalytics(chunk, contentLength);
    return originalEnd.apply(res, arguments);
  };

  next();
}

module.exports = enhancedAnalyticsMiddleware;
