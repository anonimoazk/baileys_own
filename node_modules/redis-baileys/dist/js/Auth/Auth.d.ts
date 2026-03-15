import { AuthenticationState, AuthenticationCreds } from '@whiskeysockets/baileys';
interface RedisConfig {
    host: string;
    port: number;
    password?: string;
}
declare const initAuthCreds: () => AuthenticationCreds;
declare function useRedisAuthState(redisConfig: RedisConfig, sessionId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    deleteSession: () => Promise<void>;
}>;
export { useRedisAuthState, initAuthCreds };
//# sourceMappingURL=Auth.d.ts.map