import { Queue, Worker } from 'bullmq';
export declare const messageQueue: Queue<any, any, string, any, any, string>;
interface MessageJobData {
    instanceId: string;
    event: string;
    data: any;
}
export declare const messageWorker: Worker<MessageJobData, any, string>;
export {};
