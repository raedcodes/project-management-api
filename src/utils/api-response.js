// The only two JSON shapes the API returns.
// `meta` (e.g. pagination) is optional and left out of the JSON when undefined.
const sendSuccess = (res, data, statusCode = 200, meta) =>
  res.status(statusCode).json({ success: true, data, meta });

// `details` is left out of the JSON automatically when it's undefined
const sendError = (res, statusCode, code, message, details) =>
  res.status(statusCode).json({ success: false, error: { code, message, details } });

export { sendSuccess, sendError };