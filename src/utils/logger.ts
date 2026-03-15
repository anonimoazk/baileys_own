import pino from 'pino';
import { config } from '../config.js';

const createPino = (pino as any).default ?? pino;

export const logger = createPino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});