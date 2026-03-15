import { AuthenticationState, BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';
import { Redis } from 'ioredis';

export const useRedisAuthState = async (
    redisClient: Redis,
    sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void>; deleteSession: () => Promise<void> }> => {

    const getKey = (key: string) => `${sessionId}:${key}`;

    const readData = async (key: string) => {
        try {
            const data = await redisClient.get(getKey(key));
            return data ? JSON.parse(data, (k, value) => {
                // Run Baileys default reviver first
                const parsed = BufferJSON.reviver(k, value);
                // Fallback for objects that Baileys missed (like redis-baileys old format)
                if (parsed && typeof parsed === 'object' && parsed !== null) {
                    if (parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
                        return Buffer.from(parsed.data);
                    }
                }
                return parsed;
            }) : null;
        } catch (error) {
            console.error(`Error reading data for key ${key}:`, error);
            return null;
        }
    };

    const writeData = async (key: string, data: any) => {
        try {
            const serialized = JSON.stringify(data, BufferJSON.replacer);
            await redisClient.set(getKey(key), serialized);
        } catch (error) {
            console.error(`Error writing data for key ${key}:`, error);
        }
    };

    const removeData = async (key: string) => {
        try {
            await redisClient.del(getKey(key));
        } catch (error) {
            console.error(`Error removing data for key ${key}:`, error);
        }
    };

    let creds: any;
    const credsData = await readData('creds');
    if (credsData) {
        creds = credsData;
    } else {
        creds = initAuthCreds();
    }

    const state: AuthenticationState = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data: { [key: string]: any } = {};
                await Promise.all(
                    ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    })
                );
                return data;
            },
            set: async (data: any) => {
                const tasks: Promise<void>[] = [];
                for (const category in data) {
                    for (const id in data[category]) {
                        const value = data[category][id];
                        const key = `${category}-${id}`;
                        if (value) {
                            tasks.push(writeData(key, value));
                        } else {
                            tasks.push(removeData(key));
                        }
                    }
                }
                await Promise.all(tasks);
            },
        },
    };

    return {
        state,
        saveCreds: async () => {
            await writeData('creds', state.creds);
        },
        deleteSession: async () => {
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', `${sessionId}:*`, 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        await redisClient.del(...keys);
                    }
                } while (cursor !== '0');
            } catch (error) {
                console.error(`Error deleting session ${sessionId}:`, error);
            }
        },
    };
};
