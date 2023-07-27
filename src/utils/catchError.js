const catchError = (res, error) => {
  const code = error.statusCode || 500;
  let errorMessage;

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
    case 503:
      errorMessage = "Service unavailable";
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
