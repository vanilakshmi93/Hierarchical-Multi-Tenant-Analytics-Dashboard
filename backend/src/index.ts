import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import orgRoutes from './routes/organizations';
import dashboardRoutes from './routes/dashboards';
import metricsRoutes from './routes/metrics';
import auditRoutes from './routes/audit';
import webhookRoutes from './routes/webhooks';
import { setupSocketIO, startMetricsSimulator } from './sockets';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/webhooks', webhookRoutes);

const io = setupSocketIO(httpServer);
startMetricsSimulator(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Real-time metrics simulator active`);
});
