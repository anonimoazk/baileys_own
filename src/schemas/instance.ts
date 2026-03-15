import { z } from 'zod';

export const createInstanceSchema = z.object({
  instanceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

export const sendMessageSchema = z.object({
  // Mudamos de .regex() para algo mais simples que aceita quase tudo
  to: z.string()
    .min(5)
    .max(50)
    .transform((val) => val.replace(/[^\d]/g, '')), // ✅ Isso limpa o número automaticamente!
  text: z.string().min(1).max(4096),
});

export const sendMediaSchema = z.object({
  to: z.string()
    .min(5)
    .max(50)
    .transform((val) => val.replace(/[^\d]/g, '')),
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string().min(1),
  caption: z.string().max(4096).optional(),
  fileName: z.string().max(255).optional(),
  mimetype: z.string().max(100).optional(),
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendMediaInput = z.infer<typeof sendMediaSchema>;