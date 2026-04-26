import express from 'express';
import cors from 'cors';
import { orchestrationRouter } from './routes/orchestration.js';
import { ragRouter } from './routes/rag.js';
import { toolsRouter } from './routes/tools.js';
import { spotifyRouter } from './routes/spotify.js';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/orchestration', orchestrationRouter);
app.use('/api/rag', ragRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/spotify', spotifyRouter);
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Multi-Agent API listening on port ${PORT}`);
});
