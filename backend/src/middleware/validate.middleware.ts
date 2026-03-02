import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const issues = (error as any).issues || (error as any).errors || [];
        const errorMessages = issues.map((issue: any) => {
          return `${issue.path.join('.')} - ${issue.message}`;
        });
        res.status(400).json({ error: 'Validation failed', details: errorMessages });
        return;
      }
      
      console.error('Validation Error:', error);
      res.status(500).json({ error: 'Internal server error during validation' });
      return;
    }
  };
};
