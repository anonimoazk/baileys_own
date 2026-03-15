import { baileysManager } from './services/baileysManager.js';
import { validate } from './middlewares/validate.js';
import { createInstanceSchema, sendMessageSchema, sendMediaSchema } from './schemas/instance.js';
import { authenticate } from './middlewares/auth.js';
import { createInstanceLimiter } from './middlewares/rateLimit.js';
import { Router } from 'express';
import {
  createInstance,
  getInstanceStatus,
  getInstanceQR,
  sendMessage,
  deleteInstance,
  listInstances,
  getProfilePicture,
  sendMediaMessage,
  reconnectInstance,
} from './controllers/instanceController.js';

const router = Router();

// --- Rotas Públicas (Health & Metrics) ---
router.get('/health', (req, res) => {
  const instances = baileysManager.listInstances();
  const connectedInstances = instances.filter(i => i.status.connection === 'open').length;
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    instances: { total: instances.length, connected: connectedInstances },
  });
});

router.get('/metrics', (req, res) => {
  const instances = baileysManager.listInstances();
  res.status(200).json({
    instances: instances.map(i => ({ instanceId: i.instanceId, status: i.status.connection })),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// --- Middleware de Autenticação (Protege as rotas abaixo) ---
router.use(authenticate);

// --- Rotas de Gerenciamento ---
router.post('/instance/create', createInstanceLimiter, validate(createInstanceSchema), createInstance);
router.get('/instance/status/:instanceId', getInstanceStatus);
router.get('/instance/qr/:instanceId', getInstanceQR);
router.post('/instance/reconnect/:instanceId', reconnectInstance);
router.delete('/instance/delete/:instanceId', deleteInstance);
router.get('/chat/profile-picture/:instanceId/:number', getProfilePicture);
router.get('/instances', listInstances);

// --- Rotas de Mensagens ---
router.post('/message/sendText/:instanceId', validate(sendMessageSchema), sendMessage);
router.post('/message/sendMedia/:instanceId', validate(sendMediaSchema), sendMediaMessage);

export default router;
