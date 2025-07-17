const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = 'logs';
const env = process.env.NODE_ENV || 'development';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define transport for daily rotating files
const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, `%DATE%-${env}.log`),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat
});

// Create logger instance
const logger = winston.createLogger({
  level: env === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    dailyRotateFileTransport
  ]
});

// Create request logger middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      type: 'request',
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};

// Error logger middleware
const errorLogger = (err, req, res, next) => {
  logger.error({
    type: 'error',
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  next(err);
};

module.exports = {
  logger,
  requestLogger,
  errorLogger
};
