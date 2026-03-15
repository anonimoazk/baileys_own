import { // ← MANTER como fallback
WAConnectionState, WASocket } from '@whiskeysockets/baileys';
import { IBaileysInstance } from '../types/baileys.js';
export declare class BaileysInstance implements IBaileysInstance {
    private logger;
    instanceId: string;
    qr: string | null;
    status: {
        connection: WAConnectionState;
    };
    socket: WASocket | null;
    private webhookService;
    private isReconnecting;
    private reconnectTimer;
    private deleteSessionFn;
    private consecutive405Count;
    private readonly MAX_405_RETRIES;
    private readonly BASE_405_DELAY_MS;
    constructor(instanceId: string);
    init(): Promise<void>;
    private _doInit;
    private scheduleReconnect;
    private clearSession;
    reconnect(): Promise<void>;
    destroy(logout?: boolean): Promise<void>;
    sendTextMessage(to: string, text: string): Promise<any>;
    getProfilePicture(jid: string): Promise<string | null>;
    sendMedia(to: string, type: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, caption?: string, fileName?: string, mimetype?: string): Promise<any>;
}
