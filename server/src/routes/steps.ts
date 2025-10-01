import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createStepReading, queryStepReadings, summariseStepReadings } from '../models/StepReading';

const router = Router();

const createStepSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required').default('default'),
  steps: z.number().int().nonnegative(),
  takenAt: z.union([z.coerce.date(), z.string().datetime()]).transform((value) => {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }),
});

const querySchema = z.object({
  userId: z.string().trim().default('default'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createStepSchema.parse(req.body);

    const record = createStepReading({
      userId: payload.userId,
      steps: payload.steps,
      takenAt: payload.takenAt,
    });

    res.status(201).json({ id: record.id, message: 'Step reading stored' });
  } catch (error) {
    next(error);
  }
});

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, from, to, limit } = querySchema.parse(req.query);

    const results = queryStepReadings({
      userId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit,
    });

    res.json({
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, from, to } = querySchema.parse(req.query);

    const summary = summariseStepReadings({
      userId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    res.json({
      count: summary.length,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
