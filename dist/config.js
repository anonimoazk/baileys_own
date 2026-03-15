import dotenv from 'dotenv';
dotenv.config();
export const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    webhookUrl: process.env.WEBHOOK_URL,
    webhookSecret: process.env.WEBHOOK_SECRET,
    sessionPath: process.env.SESSION_PATH || './sessions',
    logLevel: process.env.LOG_LEVEL || 'info',
};
//# sourceMappingURL=config.js.map