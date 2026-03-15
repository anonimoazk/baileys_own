import { z } from 'zod';
export declare const createInstanceSchema: z.ZodObject<{
    instanceId: z.ZodString;
}, z.core.$strip>;
export declare const sendMessageSchema: z.ZodObject<{
    to: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    text: z.ZodString;
}, z.core.$strip>;
export declare const sendMediaSchema: z.ZodObject<{
    to: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    type: z.ZodEnum<{
        image: "image";
        video: "video";
        audio: "audio";
        document: "document";
    }>;
    url: z.ZodString;
    caption: z.ZodOptional<z.ZodString>;
    fileName: z.ZodOptional<z.ZodString>;
    mimetype: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendMediaInput = z.infer<typeof sendMediaSchema>;
