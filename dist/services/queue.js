import { Queue, Worker } from 'bullmq';
import { redisClient as connection } from './redis.js';
import { logger } from '../utils/logger.js';
// Fila para mensagens recebidas
export const messageQueue = new Queue('whatsapp-messages', { connection });
// Worker para processar mensagens
export const messageWorker = new Worker('whatsapp-messages', async (job) => {
    const { instanceId, event, data } = job.data;
    logger.info({ instanceId, event, jobId: job.id }, 'Processando mensagem da fila');
    try {
        // Aqui você pode processar com IA, salvar no banco, etc.
        // Por enquanto, apenas envia o webhook
        const { WebhookService } = await import('./webhook.js');
        const webhookService = new WebhookService();
        await webhookService.sendWebhook(instanceId, event, data);
        logger.info({ instanceId, jobId: job.id }, 'Mensagem processada com sucesso');
    }
    catch (error) {
        logger.error({ instanceId, jobId: job.id, error: error.message }, 'Erro ao processar mensagem');
        throw error; // BullMQ fará retry automaticamente
    }
}, {
    connection,
    concurrency: 5, // Processar até 5 mensagens simultaneamente
    limiter: {
        max: 10, // Máximo de 10 jobs
        duration: 1000, // Por segundo
    },
});
messageWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Job completado');
});
messageWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job falhou');
});
//# sourceMappingURL=queue.js.map