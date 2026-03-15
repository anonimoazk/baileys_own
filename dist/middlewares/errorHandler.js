import { logger } from '../utils/logger.js';
export const errorHandler = (err, req, res, next) => {
    logger.error({
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
    }, 'Erro não tratado');
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
};
export const notFoundHandler = (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
};
//# sourceMappingURL=errorHandler.js.map