const redis = require('redis');
const { createClient } = redis;

const redisClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_HOST,
        port: 10040
    }
});

module.exports = redisClient;