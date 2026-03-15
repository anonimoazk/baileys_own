"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuthCreds = void 0;
exports.useRedisAuthState = useRedisAuthState;
const redis_1 = require("redis");
const WAProto_1 = require("@whiskeysockets/baileys/WAProto");
const crypto_1 = require("@whiskeysockets/baileys/lib/Utils/crypto");
const generics_1 = require("@whiskeysockets/baileys/lib/Utils/generics");
const crypto_2 = require("crypto");
const uuid_1 = require("uuid");
const initAuthCreds = () => {
    const identityKey = crypto_1.Curve.generateKeyPair();
    return {
        noiseKey: crypto_1.Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: (0, crypto_1.signedKeyPair)(identityKey, 1),
        registrationId: (0, generics_1.generateRegistrationId)(),
        advSecretKey: (0, crypto_2.randomBytes)(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false
        },
        deviceId: (0, crypto_2.randomBytes)(16).toString('base64'),
        phoneId: (0, uuid_1.v4)(),
        identityId: (0, crypto_2.randomBytes)(20),
        registered: false,
        backupToken: (0, crypto_2.randomBytes)(20),
        registration: {},
        pairingEphemeralKeyPair: crypto_1.Curve.generateKeyPair(),
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
    };
};
exports.initAuthCreds = initAuthCreds;
function bufferToJSON(obj) {
    if (Buffer.isBuffer(obj)) {
        return { type: 'Buffer', data: Array.from(obj) };
    }
    else if (Array.isArray(obj)) {
        return obj.map(bufferToJSON);
    }
    else if (typeof obj === 'object' && obj !== null) {
        if (typeof obj.toJSON === 'function') {
            return obj.toJSON();
        }
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = bufferToJSON(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
function jsonToBuffer(obj) {
    if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    }
    else if (Array.isArray(obj)) {
        return obj.map(jsonToBuffer);
    }
    else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = jsonToBuffer(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
function useRedisAuthState(redisConfig, sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const redisClient = (0, redis_1.createClient)({
            password: redisConfig.password,
            socket: {
                host: redisConfig.host,
                port: redisConfig.port,
            },
        });
        yield redisClient.connect();
        // Define helper functions
        const getKey = (key) => `${sessionId}:${key}`;
        const writeData = (key, data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const serialized = JSON.stringify(bufferToJSON(data));
                yield redisClient.set(getKey(key), serialized);
            }
            catch (error) {
                console.error(`Error writing data for key ${key}:`, error);
                throw error;
            }
        });
        const readData = (key) => __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield redisClient.get(getKey(key));
                return data ? jsonToBuffer(JSON.parse(data)) : null;
            }
            catch (error) {
                console.error(`Error reading data for key ${key}:`, error);
                return null;
            }
        });
        const removeData = (key) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield redisClient.del(getKey(key));
            }
            catch (error) {
                console.error(`Error removing data for key ${key}:`, error);
            }
        });
        // Initialize credentials
        let creds;
        const data = yield readData("auth_creds");
        creds = data || initAuthCreds();
        const state = {
            creds,
            keys: {
                get: (type, ids) => __awaiter(this, void 0, void 0, function* () {
                    const data = {};
                    yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
                        let value = yield readData(`${type}-${id}`);
                        if (type === "app-state-sync-key" && value) {
                            value = WAProto_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    })));
                    return data;
                }),
                set: (data) => __awaiter(this, void 0, void 0, function* () {
                    const tasks = Object.entries(data).flatMap(([category, categoryData]) => Object.entries(categoryData || {}).map(([id, value]) => {
                        const key = `${category}-${id}`;
                        return value ? writeData(key, value) : removeData(key);
                    }));
                    yield Promise.all(tasks);
                }),
            },
        };
        return {
            state,
            saveCreds: () => __awaiter(this, void 0, void 0, function* () {
                yield writeData("auth_creds", state.creds);
            }),
            deleteSession: () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const keys = yield redisClient.keys(`${sessionId}:*`);
                    if (keys.length > 0) {
                        yield redisClient.del(keys);
                    }
                }
                catch (error) {
                    console.error(`Error deleting session ${sessionId}:`, error);
                    throw error;
                }
                finally {
                    yield redisClient.quit();
                }
            }),
        };
    });
}
//# sourceMappingURL=Auth.js.map