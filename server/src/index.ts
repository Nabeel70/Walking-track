import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import stepsRouter from './routes/steps';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/steps', stepsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation error',
      issues: err.issues,
    });
    return;
  }

  if (err instanceof Error) {
    res.status(400).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: 'Unexpected error' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
