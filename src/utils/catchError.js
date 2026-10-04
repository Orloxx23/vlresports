const Sentry = require("@sentry/node");

// Axios errors carry the upstream status in error.response.status, not in
// error.statusCode. An upstream 404 means the client asked for a bad id and
// must not be reported as a server error. Any other upstream failure (a 403
// from the proxy rejecting our token, a 429, a 5xx) is vlr.gg or the proxy
// failing us: a gateway problem that has to reach GlitchTip.
const resolveStatusCode = (error) => {
  if (error.statusCode) return error.statusCode;
  if (error.response && error.response.status) {
    return error.response.status === 404 ? 404 : 502;
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return 504;
  return 500;
};

const catchError = (res, error) => {
  const code = resolveStatusCode(error);
  let errorMessage;

  if (code >= 500) {
    Sentry.captureException(error);
  }

  switch (code) {
    case 400:
      errorMessage = "Bad request";
      break;
    case 401:
      errorMessage = "Unauthorized";
      break;
    case 403:
      errorMessage = "Forbidden";
      break;
    case 404:
      errorMessage = "Not found";
      break;
    case 405:
      errorMessage = "Method not allowed";
      break;
    case 408:
      errorMessage = "Request timeout";
      break;
    case 429:
      errorMessage = "Too many requests";
      break;
    case 500:
      errorMessage = "Internal server error";
      break;
    case 502:
      errorMessage = "Bad gateway";
      break;
    case 503:
      errorMessage = "Service unavailable";
      break;
    case 504:
      errorMessage = "Gateway timeout";
      break;
    case 505:
      errorMessage = "HTTP version not supported";
      break;
    case 508:
      errorMessage = "Loop detected";
      break;
    default:
      errorMessage = "Internal server error";
      break;
  }

  res.status(code).json({
    status: "error",
    message: {
      error: code,
      message: errorMessage,
    },
  });
};

module.exports = catchError;
