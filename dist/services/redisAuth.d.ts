import { AuthenticationState } from '@whiskeysockets/baileys';
import { Redis } from 'ioredis';
export declare const useRedisAuthState: (redisClient: Redis, sessionId: string) => Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    deleteSession: () => Promise<void>;
}>;
