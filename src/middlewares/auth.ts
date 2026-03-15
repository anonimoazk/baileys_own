import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const API_KEY = process.env.API_KEY;

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!API_KEY) {
    logger.warn('API_KEY não configurada - autenticação desabilitada');
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey || apiKey !== API_KEY) {
    logger.warn({ ip: req.ip }, 'Tentativa de acesso não autorizado');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};