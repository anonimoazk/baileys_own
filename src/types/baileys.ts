import { DisconnectReason, ConnectionState, WAConnectionState } from '@whiskeysockets/baileys';

export interface IBaileysInstance {
  instanceId: string;
  qr: string | null;
  status: { connection: WAConnectionState };
  socket: any | null;

  init(): Promise<void>;
  reconnect(): Promise<void>;
  destroy(logout?: boolean): Promise<void>;
  sendTextMessage(to: string, text: string): Promise<any>;
  getProfilePicture(jid: string): Promise<string | null>;
  sendMedia(to: string, type: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, caption?: string, fileName?: string, mimetype?: string): Promise<any>;
}

export type BaileysInstanceStatus = {
  instanceId: string;
  status: { connection: WAConnectionState };
  qr: string | null;
};
