const Sentry = require("@sentry/node");

// Axios errors carry the upstream status in error.response.status, not in
// error.statusCode. An upstream 4xx (usually a 404 for a bad id) is the
// client's mistake and must not be reported as a server error; upstream 5xx
// and timeouts are gateway problems, not internal ones.
const resolveStatusCode = (error) => {
  if (error.statusCode) return error.statusCode;
  if (error.response && error.response.status) {
    const upstream = error.response.status;
    return upstream >= 500 ? 502 : upstream;
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
