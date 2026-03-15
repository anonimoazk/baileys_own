import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
const redisPassword = process.env.REDIS_PASSWORD || process.env.PASSWORD || process.env.REDIS_PASS;
const getRedisConfig = () => {
    if (process.env.REDIS_URL) {
        try {
            const parsedUrl = new URL(process.env.REDIS_URL);
            return {
                host: parsedUrl.hostname || 'redis',
                port: parseInt(parsedUrl.port || '6379'),
                password: parsedUrl.password || undefined,
            };
        }
        catch (e) {
            // fallback if it's not a valid URL
            logger.warn('Invalid REDIS_URL format, falling back to REDIS_HOST');
        }
    }
    return {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: redisPassword || undefined,
    };
};
const config = getRedisConfig();
// ioredis needs string for host, making sure this is explicitly clean
export const redisClient = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: null,
});
redisClient.on('connect', () => {
    logger.info('Connected to Redis successfully');
});
redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
});
//# sourceMappingURL=redis.js.map