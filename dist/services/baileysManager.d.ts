import { IBaileysInstance, BaileysInstanceStatus } from '../types/baileys.js';
declare class BaileysManager {
    private instances;
    initAll(): Promise<void>;
    createInstance(instanceId: string): Promise<IBaileysInstance>;
    getInstance(instanceId: string): IBaileysInstance | undefined;
    deleteInstance(instanceId: string, logout?: boolean): Promise<void>;
    listInstances(): BaileysInstanceStatus[];
}
export declare const baileysManager: BaileysManager;
export {};
