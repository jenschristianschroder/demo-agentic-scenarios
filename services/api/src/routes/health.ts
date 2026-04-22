import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'multi-agent-api' });
});

healthRouter.get('/ready', (_req, res) => {
  res.json({ status: 'ready' });
});
