import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
export const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                // O Zod usa '.issues' para listar os erros de validação
                logger.warn({ errors: error.issues }, 'Validação falhou');
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.issues,
                });
            }
            next(error);
        }
    };
};
//# sourceMappingURL=validate.js.map