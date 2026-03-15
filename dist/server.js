import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import router from './routes.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { baileysManager } from './services/baileysManager.js';
import { messageWorker } from './services/queue.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { logger } from './utils/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);
app.use('/api', router);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFoundHandler);
app.use(errorHandler);
process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
});
process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught Exception');
    process.exit(1);
});
const server = app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    // Iniciar a auto-restauração das instâncias em background
    baileysManager.initAll().catch(err => {
        logger.error({ err }, 'Erro fatal durante inicialização das instâncias');
    });
});
server.keepAliveTimeout = 70000; // Maior que o padrão do Nginx
server.headersTimeout = 71000;
const shutdown = async () => {
    logger.info('Recebido sinal de shutdown, encerrando graciosamente...');
    // Parar de aceitar novas conexões
    server.close(() => {
        logger.info('Servidor HTTP fechado');
    });
    // Fechar todas as instâncias Baileys
    const instances = baileysManager.listInstances();
    for (const instance of instances) {
        try {
            await baileysManager.deleteInstance(instance.instanceId, false); // graceful disconnect, DO NOT logout
            logger.info({ instanceId: instance.instanceId }, 'Instância fechada graciosamente');
        }
        catch (error) {
            logger.error({ instanceId: instance.instanceId, error: error.message }, 'Erro ao fechar instância');
        }
    }
    // Fechar worker de filas
    await messageWorker.close();
    logger.info('Worker de filas fechado');
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
//# sourceMappingURL=server.js.map