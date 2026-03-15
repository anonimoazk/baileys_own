import { BaileysInstance } from './baileys.js';
import { logger } from '../utils/logger.js';
import { redisClient } from './redis.js';
import path from 'path';
import fs from 'fs/promises';
class BaileysManager {
    instances = new Map();
    async initAll() {
        logger.info('Iniciando auto-restauração de instâncias...');
        const instanceIds = new Set();
        // 1. Procurar sessões no disco
        try {
            const sessionPath = process.env.SESSION_PATH || './sessions';
            const files = await fs.readdir(sessionPath);
            for (const file of files) {
                // Ignorar arquivos ocultos ou soltos, procurar pastas
                const stat = await fs.stat(path.join(sessionPath, file));
                if (stat.isDirectory() && !file.startsWith('.')) {
                    instanceIds.add(file);
                }
            }
        }
        catch (err) {
            logger.warn('Nenhuma pasta de sessão em disco encontrada ou erro ao ler.');
        }
        // 2. Procurar sessões no Redis
        try {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'baileys:*:creds', 'COUNT', 100);
                cursor = nextCursor;
                for (const key of keys) {
                    // key is like 'baileys:INSTANCE_ID:creds'
                    const match = key.match(/^baileys:(.+):creds$/);
                    if (match && match[1]) {
                        instanceIds.add(match[1]);
                    }
                }
            } while (cursor !== '0');
        }
        catch (err) {
            logger.warn('Erro ao ler sessões do Redis durante inicialização.');
        }
        // 3. Inicializar as instâncias em lotes para evitar sobrecarga
        const ids = Array.from(instanceIds);
        logger.info(`Encontradas ${ids.length} instâncias para restaurar.`);
        const batchSize = 5;
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(async (id) => {
                try {
                    if (!this.instances.has(id)) {
                        await this.createInstance(id);
                    }
                }
                catch (err) {
                    logger.error({ instanceId: id, err: err.message }, 'Falha ao restaurar instância');
                }
            }));
            if (i + batchSize < ids.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s entre pacotes
            }
        }
        logger.info('Auto-restauração concluída.');
    }
    async createInstance(instanceId) {
        if (this.instances.has(instanceId)) {
            throw new Error('Instance already exists');
        }
        const instance = new BaileysInstance(instanceId);
        await instance.init();
        this.instances.set(instanceId, instance);
        return instance;
    }
    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }
    async deleteInstance(instanceId, logout = true) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error('Instance not found');
        }
        if (logout) {
            const sessionPath = path.join(process.env.SESSION_PATH || './sessions', instanceId);
            try {
                await fs.rm(sessionPath, { recursive: true, force: true });
                logger.info({ instanceId }, 'Pasta de sessão removida com sucesso');
            }
            catch (err) {
                logger.error({ instanceId, err }, 'Erro ao remover pasta de sessão');
            }
            // Also clean up Redis if a redisClient function exists from the auth payload
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', `baileys:${instanceId}:*`, 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        await redisClient.del(...keys);
                    }
                } while (cursor !== '0');
                logger.info({ instanceId }, 'Chaves Redis removidas com sucesso');
            }
            catch (err) {
                logger.error({ instanceId, err }, 'Erro ao remover chaves da sessão no Redis');
            }
        }
        await instance.destroy(logout);
        this.instances.delete(instanceId);
    }
    listInstances() {
        const instanceStatuses = [];
        this.instances.forEach((instance) => {
            instanceStatuses.push({
                instanceId: instance.instanceId,
                status: instance.status,
                qr: instance.qr,
            });
        });
        return instanceStatuses;
    }
}
export const baileysManager = new BaileysManager();
//# sourceMappingURL=baileysManager.js.map