const { sendError, AppError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return sendError(res, err);
  sendError(res, new AppError(err.message || 'Internal server error', 500));
}

module.exports = errorHandler;
