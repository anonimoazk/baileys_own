import axios from 'axios';
import { logger } from '../utils/logger.js';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
export class WebhookService {
    async sendWebhook(instanceId, event, data) {
        if (!WEBHOOK_URL) {
            return;
        }
        const payload = {
            instanceId,
            event,
            data,
        };
        // Exemplo de ajuste no processador da fila
        try {
            await axios.post(WEBHOOK_URL, payload);
        }
        catch (error) {
            if (error.response?.status === 404) {
                logger.warn(`Webhook 404 para instância ${instanceId}. Ignorando para evitar ruído.`);
                // Não lançamos o erro novamente para a fila não tentar de novo (job.fail)
                return;
            }
            // Para outros erros (500, timeout), a fila pode tentar de novo
            throw error;
        }
    }
}
//# sourceMappingURL=webhook.js.map