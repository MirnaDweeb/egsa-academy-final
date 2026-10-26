const env = require('../config/env');

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.statusCode = status;
    this.status = status;
    this.details = details;
    this.isOperational = true;
  }
  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized', details) { return new ApiError(401, msg, details); }
  static forbidden(msg = 'Forbidden', details) { return new ApiError(403, msg, details); }
  static notFound(msg = 'Not found', details) { return new ApiError(404, msg, details); }
  static conflict(msg = 'Conflict', details) { return new ApiError(409, msg, details); }
  static internal(msg = 'Internal server error') { return new ApiError(500, msg); }
}

function errorHandler(err, req, res, next) {
  if (err.name === 'CastError') {
    err.statusCode = 404;
    err.message = `Resource not found with id: ${err.value}`;
    err.isOperational = true;
  }
  if (err.name === 'MulterError') {
    err.statusCode = 400;
    err.isOperational = true;
  }
  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational || !env.isProduction ? err.message : 'An unexpected error occurred';

  if (!env.isTest && statusCode >= 500) {
    console.error(`[Error 500] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      message,
      details: err.details || (env.isProduction ? undefined : err.stack),
    },
  });
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: { message: `Cannot ${req.method} ${req.originalUrl}` },
  });
}

module.exports = {
  AppError,
  ApiError,
  errorHandler,
  notFoundHandler,
};
