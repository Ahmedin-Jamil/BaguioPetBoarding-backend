const Redis = require('ioredis');
const { logger } = require('./logger');

if (process.env.REDIS_DISABLED === 'true') {
  module.exports = {
    on: () => {},
    get: async () => null,
    set: async () => {},
    del: async () => {},
    // Add other mock methods as needed
  };
  return;
}

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost', // changed from 'redis' to 'localhost'
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

const redis = new Redis(redisConfig);

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('connect', () => {
  logger.info('Connected to Redis successfully');
});

module.exports = redis;
