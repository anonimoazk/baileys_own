import makeWASocket, { DisconnectReason, useMultiFileAuthState, downloadMediaMessage, fetchLatestBaileysVersion, } from '@whiskeysockets/baileys';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { useRedisAuthState } from './redisAuth.js';
import { redisClient } from './redis.js';
import path from 'path';
import fs from 'fs/promises';
import { messageQueue } from './queue.js';
import { logger } from '../utils/logger.js';
import { pino } from 'pino';
import NodeCache from 'node-cache';
import { WebhookService } from './webhook.js';
export class BaileysInstance {
    logger;
    instanceId;
    qr = null;
    status = { connection: 'close' };
    socket = null;
    webhookService;
    // ── Stability: debounce & session management ──
    isReconnecting = false;
    reconnectTimer = null;
    deleteSessionFn = null;
    // ── Rate-limit backoff (Code 405 from WhatsApp = connection blocked) ──
    consecutive405Count = 0;
    MAX_405_RETRIES = 5;
    BASE_405_DELAY_MS = 30000; // 30s base → 30, 60, 120, 240, 480s
    constructor(instanceId) {
        this.instanceId = instanceId;
        this.webhookService = new WebhookService();
        this.logger = logger.child({ instanceId });
        this.logger.info('Instância criada');
    }
    async init() {
        // ── Debounce: prevent multiple simultaneous init() calls ──
        if (this.isReconnecting) {
            console.log(`[${this.instanceId}] ⏳ Reconexão já em andamento, ignorando chamada duplicada.`);
            return;
        }
        this.isReconnecting = true;
        try {
            await this._doInit();
        }
        finally {
            this.isReconnecting = false;
        }
    }
    async _doInit() {
        this.logger.info('Iniciando autenticação...');
        const SESSION_PATH = process.env.SESSION_PATH || './sessions';
        // ── Close previous socket if exists (prevent ghost connections) ──
        if (this.socket) {
            try {
                this.socket.ev.removeAllListeners('connection.update');
                this.socket.ev.removeAllListeners('messages.upsert');
                this.socket.ev.removeAllListeners('creds.update');
                this.socket.end(undefined);
            }
            catch (e) {
                // ignore cleanup errors
            }
            this.socket = null;
        }
        let state, saveCreds;
        // ── Redis auth state (with deleteSession capture) ──
        if (process.env.REDIS_URL || process.env.REDIS_HOST) {
            try {
                console.log(`[${this.instanceId}] Usando Redis Auth State com redisClient compartilhado`);
                const result = await useRedisAuthState(redisClient, `baileys:${this.instanceId}`);
                state = result.state;
                saveCreds = result.saveCreds;
                // ── Capture deleteSession for cleanup on Logged Out ──
                this.deleteSessionFn = result.deleteSession || null;
                console.log(`[${this.instanceId}] ✅ Redis OK`);
            }
            catch (err) {
                console.error(`[${this.instanceId}] ❌ Redis falhou:`, err);
                const result = await useMultiFileAuthState(path.join(SESSION_PATH, this.instanceId));
                state = result.state;
                saveCreds = result.saveCreds;
                this.deleteSessionFn = null;
                console.log(`[${this.instanceId}] ⚠️ Fallback: usando disco`);
            }
        }
        else {
            const result = await useMultiFileAuthState(path.join(SESSION_PATH, this.instanceId));
            state = result.state;
            saveCreds = result.saveCreds;
            this.deleteSessionFn = null;
            console.log(`[${this.instanceId}] ℹ️ Redis não configurado, usando disco`);
        }
        // ── Fetch latest WA Web version at runtime to avoid 405 rejections ──
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[${this.instanceId}] 📡 Versão WA Web: ${version.join('.')} (isLatest: ${isLatest})`);
        this.socket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            // ── 1. ANTI-LOGOUT ──
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            linkPreviewImageThumbnailWidth: 192,
            // ── 2. BROWSER (CRITICAL for stability) ──
            // Modern Chrome version to avoid anti-bot detection
            browser: ['Ubuntu', 'Chrome', '126.0.6478.127'],
            // ── 3. KEEP-ALIVE ──
            connectTimeoutMs: 90000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000, // Ping every 10s (aggressive, prevents idle timeout)
            // ── 4. PERFORMANCE ──
            logger: pino({ level: 'silent' }),
            msgRetryCounterCache: new NodeCache(),
            emitOwnEvents: false, // Don't process our own outgoing messages as events
            // ── 5. RETRY ──
            retryRequestDelayMs: 5000,
        });
        // ── CONNECTION UPDATE HANDLER ──
        this.socket.ev.on('connection.update', async (update) => {
            this.logger.debug({ update }, 'Evento connection.update');
            if (update.connection) {
                this.status.connection = update.connection;
                this.logger.info(`Status: ${update.connection}`);
            }
            // Capture QR code
            if (update.qr) {
                this.qr = update.qr;
                this.logger.info('QR Code recebido');
            }
            else if (update.connection === 'open') {
                this.qr = null;
                this.consecutive405Count = 0; // ← Reset ao conectar com sucesso
                console.log(`[${this.instanceId}] ✅ Conectado com sucesso ao WhatsApp`);
            }
            // Send to queue
            await messageQueue.add('connection.update', {
                instanceId: this.instanceId,
                event: 'connection.update',
                data: { status: this.status, qr: this.qr },
            });
            // ── DISCONNECTION HANDLING ──
            if (update.connection === 'close') {
                const statusCode = update.lastDisconnect?.error?.output?.statusCode;
                const reason = DisconnectReason;
                if (statusCode === reason.loggedOut) {
                    // ── LOGGED OUT (401): Limpar sessão e aguardar novo QR ──
                    console.log(`[${this.instanceId}] 🔒 Logged Out. Limpando sessão e gerando novo QR...`);
                    await this.clearSession();
                    this.scheduleReconnect(5000);
                }
                else if (statusCode === reason.badSession) {
                    // ── BAD SESSION (500): Sessão corrompida, limpar e gerar novo QR ──
                    console.log(`[${this.instanceId}] 🗑️ Sessão corrompida (badSession). Limpando e aguardando novo QR...`);
                    await this.clearSession();
                    this.scheduleReconnect(5000);
                }
                else if (statusCode === 405) {
                    // ── CODE 405: WhatsApp bloqueou a conexão (rate-limit / IP block) ──
                    // NÃO limpar a sessão — ela está OK. Usar backoff exponencial.
                    this.consecutive405Count++;
                    if (this.consecutive405Count > this.MAX_405_RETRIES) {
                        console.log(`[${this.instanceId}] 🚫 Bloqueado pelo WhatsApp (405) após ${this.consecutive405Count - 1} tentativas. Aguardando reconexão manual via /reconnect.`);
                        this.status.connection = 'close';
                        // Para de reconectar — o usuário deve chamar o endpoint de reconexão manualmente
                    }
                    else {
                        const delayMs = this.BASE_405_DELAY_MS * Math.pow(2, this.consecutive405Count - 1);
                        const delaySeg = Math.round(delayMs / 1000);
                        console.log(`[${this.instanceId}] ⏳ Bloqueado (405) tentativa ${this.consecutive405Count}/${this.MAX_405_RETRIES}. Aguardando ${delaySeg}s antes de tentar novamente...`);
                        this.scheduleReconnect(delayMs);
                    }
                }
                else if (statusCode === reason.connectionClosed) {
                    // connectionClosed (428) — typically means replaced by another device
                    console.log(`[${this.instanceId}] ⚠️ Conexão substituída (Code: ${statusCode}). Reconectando...`);
                    this.scheduleReconnect(5000);
                }
                else {
                    // All other codes (515 Restart Required, 408 Timeout, etc) → reconnect
                    console.log(`[${this.instanceId}] 🔄 Desconectado (Code: ${statusCode}). Reconectando em 3s...`);
                    this.scheduleReconnect(3000);
                }
            }
            // Send webhook
            this.webhookService.sendWebhook(this.instanceId, 'connection.update', { status: this.status, qr: this.qr });
        });
        // ── MESSAGE HANDLER ──
        this.socket.ev.on('messages.upsert', async (m) => {
            this.logger.info('Evento messages.upsert recebido');
            try {
                for (const msg of m.messages) {
                    const messageContent = msg.message;
                    if (!messageContent)
                        continue;
                    // Detect media
                    const mediaTypes = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'];
                    let hasMedia = false;
                    let mediaType = '';
                    for (const type of mediaTypes) {
                        if (messageContent[type]) {
                            hasMedia = true;
                            mediaType = type;
                            break;
                        }
                    }
                    if (hasMedia) {
                        console.log(`[${this.instanceId}] 📎 Mídia detectada: ${mediaType}`);
                        try {
                            const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                                logger: pino({ level: 'silent' }),
                                reuploadRequest: this.socket.updateMediaMessage
                            });
                            const base64 = buffer.toString('base64');
                            const mediaMsg = messageContent[mediaType];
                            const mimeType = mediaMsg?.mimetype || 'application/octet-stream';
                            const cleanMimeType = mimeType.split(';')[0].trim();
                            const dataUrl = `data:${cleanMimeType};base64,${base64}`;
                            if (mediaMsg) {
                                mediaMsg.url = dataUrl;
                            }
                            console.log(`[${this.instanceId}] ✅ Mídia baixada, tamanho: ${buffer.length} bytes`);
                        }
                        catch (mediaError) {
                            console.error(`[${this.instanceId}] ❌ Erro ao baixar mídia:`, mediaError);
                        }
                    }
                }
                await messageQueue.add('messages.upsert', {
                    instanceId: this.instanceId,
                    event: 'messages.upsert',
                    data: m,
                }, {
                    priority: 1,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                });
                this.logger.info('Mensagem adicionada à fila');
            }
            catch (error) {
                this.logger.error(`[${this.instanceId}] Erro ao processar mensagens:`, error);
                this.webhookService.sendWebhook(this.instanceId, 'messages.upsert', m);
            }
        });
        // ── MESSAGE STATUS UPDATE HANDLER (receipts: sent, delivered, read) ──
        this.socket.ev.on('messages.update', async (updates) => {
            this.logger.info(`Evento messages.update: ${updates.length} atualizações`);
            try {
                await messageQueue.add('messages.update', {
                    instanceId: this.instanceId,
                    event: 'messages.update',
                    data: updates,
                }, {
                    priority: 2,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                });
                this.logger.info('Status updates adicionados à fila');
            }
            catch (error) {
                this.logger.error(`Erro ao processar messages.update:`, error);
            }
            // Send via webhook too
            this.webhookService.sendWebhook(this.instanceId, 'messages.update', updates);
        });
        // ── MESSAGE RECEIPT UPDATE HANDLER (✓ ✓✓ ✓✓ azul) ──
        this.socket.ev.on('message-receipt.update', async (updates) => {
            this.logger.info(`Evento message-receipt.update: ${updates.length} recibos`);
            try {
                await messageQueue.add('message-receipt.update', {
                    instanceId: this.instanceId,
                    event: 'message-receipt.update',
                    data: updates,
                }, {
                    priority: 2,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                });
                this.logger.info('Recibos adicionados à fila');
            }
            catch (error) {
                this.logger.error(`Erro ao processar message-receipt.update:`, error);
            }
            // Send via webhook too
            this.webhookService.sendWebhook(this.instanceId, 'message-receipt.update', updates);
        });
        this.socket.ev.on('creds.update', saveCreds);
        console.log(`[${this.instanceId}] Handlers configurados.`);
    }
    // ── Schedule reconnect with debounce ──
    scheduleReconnect(delayMs) {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.init();
        }, delayMs);
    }
    // ── Clear session from Redis or disk ──
    async clearSession() {
        try {
            if (this.deleteSessionFn) {
                await this.deleteSessionFn();
                console.log(`[${this.instanceId}] 🗑️ Sessão Redis limpa.`);
            }
        }
        catch (err) {
            console.error(`[${this.instanceId}] Erro ao limpar sessão Redis:`, err);
        }
        // Also try to clear disk session as extra safety
        try {
            const SESSION_PATH = process.env.SESSION_PATH || './sessions';
            const sessionDir = path.join(SESSION_PATH, this.instanceId);
            await fs.rm(sessionDir, { recursive: true, force: true });
            console.log(`[${this.instanceId}] 🗑️ Sessão disco limpa.`);
        }
        catch (err) {
            // Ignore — might not exist on disk
        }
    }
    // ── Force reconnect (resets 405 backoff counter) ──
    async reconnect() {
        console.log(`[${this.instanceId}] 🔁 Reconexão forçada via API. Resetando contador de bloqueio...`);
        this.consecutive405Count = 0;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        await this.init();
    }
    async destroy(logout = false) {
        console.log(`[${this.instanceId}] Destruindo instância...`);
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        try {
            if (logout) {
                this.socket?.logout();
            }
            else {
                this.socket?.end(undefined);
            }
        }
        catch (e) {
            // ignore
        }
        this.socket = null;
    }
    async sendTextMessage(to, text) {
        if (!this.socket || this.status.connection !== 'open') {
            console.error(`[${this.instanceId}] Tentativa de enviar mensagem sem conexão.`);
            throw new Error('Instance not connected');
        }
        const formattedTo = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        console.log(`[${this.instanceId}] Enviando mensagem para ${formattedTo}`);
        return this.socket.sendMessage(formattedTo, { text });
    }
    async getProfilePicture(jid) {
        if (!this.socket || this.status.connection !== 'open') {
            throw new Error('Instance not connected');
        }
        try {
            const formattedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
            console.log(`[${this.instanceId}] Buscando foto de perfil para ${formattedJid}`);
            const url = await this.socket.profilePictureUrl(formattedJid, 'image'); // 'image' for high res
            return url || null;
        }
        catch (error) {
            // 401/404/403 means privacy settings or no pic
            this.logger.warn(`Não foi possível obter foto de perfil de ${jid}: ${error}`);
            return null;
        }
    }
    async sendMedia(to, type, mediaUrl, caption, fileName, mimetype) {
        if (!this.socket || this.status.connection !== 'open') {
            throw new Error('Instance not connected');
        }
        const formattedTo = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        console.log(`[${this.instanceId}] Enviando ${type} para ${formattedTo}`);
        // Fetch media buffer from URL or decode base64
        let mediaBuffer;
        if (mediaUrl.startsWith('data:')) {
            // base64 data URL
            const base64Data = mediaUrl.split(',')[1];
            mediaBuffer = Buffer.from(base64Data, 'base64');
        }
        else {
            // HTTP URL - fetch the file
            const response = await fetch(mediaUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch media from URL: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            mediaBuffer = Buffer.from(arrayBuffer);
        }
        let message;
        switch (type) {
            case 'image':
                message = {
                    image: mediaBuffer,
                    caption: caption || undefined,
                    mimetype: mimetype || 'image/jpeg',
                };
                break;
            case 'video':
                message = {
                    video: mediaBuffer,
                    caption: caption || undefined,
                    mimetype: mimetype || 'video/mp4',
                };
                break;
            case 'audio':
                message = {
                    audio: mediaBuffer,
                    mimetype: mimetype || 'audio/mpeg',
                    ptt: false, // set true for voice note
                };
                break;
            case 'document':
                message = {
                    document: mediaBuffer,
                    mimetype: mimetype || 'application/pdf',
                    fileName: fileName || 'document',
                    caption: caption || undefined,
                };
                break;
            default:
                throw new Error(`Unsupported media type: ${type}`);
        }
        const result = await this.socket.sendMessage(formattedTo, message);
        console.log(`[${this.instanceId}] ✅ ${type} enviado com sucesso`);
        return result;
    }
}
//# sourceMappingURL=baileys.js.map