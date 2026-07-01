import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { AuthPayload } from '../types';
import { checkAnomalies } from '../services/metrics';
import { deliverWebhook } from '../services/webhooks';

interface Collaborator {
  userId: string;
  name: string;
  color: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  const dashboardRooms = new Map<string, Map<string, Collaborator>>();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      const userResult = await pool.query('SELECT id, name FROM users WHERE id = $1', [payload.userId]);
      if (userResult.rows.length === 0) return next(new Error('User not found'));

      socket.data.userId = payload.userId;
      socket.data.userName = userResult.rows[0].name;
      socket.data.teamIds = payload.teamIds || [];
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.data.userName}`);

    socket.on('join-dashboard', async (dashboardId: string) => {
      const dashResult = await pool.query('SELECT team_id FROM dashboards WHERE id = $1', [dashboardId]);
      if (dashResult.rows.length === 0) return;

      const teamId = dashResult.rows[0].team_id;
      if (!socket.data.teamIds.includes(teamId)) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(`dashboard:${dashboardId}`);
      socket.data.currentDashboard = dashboardId;

      if (!dashboardRooms.has(dashboardId)) {
        dashboardRooms.set(dashboardId, new Map());
      }
      const room = dashboardRooms.get(dashboardId)!;
      const color = COLORS[room.size % COLORS.length];
      room.set(socket.data.userId, { userId: socket.data.userId, name: socket.data.userName, color });

      io.to(`dashboard:${dashboardId}`).emit('collaborators', Array.from(room.values()));
    });

    socket.on('leave-dashboard', (dashboardId: string) => {
      socket.leave(`dashboard:${dashboardId}`);
      const room = dashboardRooms.get(dashboardId);
      if (room) {
        room.delete(socket.data.userId);
        io.to(`dashboard:${dashboardId}`).emit('collaborators', Array.from(room.values()));
      }
    });

    // Real-time widget updates
    socket.on('widget-update', (data: { dashboardId: string; widgetId: string; changes: Record<string, unknown> }) => {
      socket.to(`dashboard:${data.dashboardId}`).emit('widget-updated', {
        widgetId: data.widgetId,
        changes: data.changes,
        updatedBy: { userId: socket.data.userId, name: socket.data.userName },
      });
    });

    socket.on('widget-position', (data: { dashboardId: string; widgetId: string; position: Record<string, number> }) => {
      socket.to(`dashboard:${data.dashboardId}`).emit('widget-positioned', {
        widgetId: data.widgetId,
        position: data.position,
        updatedBy: { userId: socket.data.userId, name: socket.data.userName },
      });
    });

    socket.on('widget-add', (data: { dashboardId: string; widget: Record<string, unknown> }) => {
      socket.to(`dashboard:${data.dashboardId}`).emit('widget-added', {
        widget: data.widget,
        addedBy: { userId: socket.data.userId, name: socket.data.userName },
      });
    });

    socket.on('widget-delete', (data: { dashboardId: string; widgetId: string }) => {
      socket.to(`dashboard:${data.dashboardId}`).emit('widget-deleted', {
        widgetId: data.widgetId,
        deletedBy: { userId: socket.data.userId, name: socket.data.userName },
      });
    });

    socket.on('cursor-move', (data: { dashboardId: string; x: number; y: number }) => {
      socket.to(`dashboard:${data.dashboardId}`).emit('cursor-moved', {
        userId: socket.data.userId,
        name: socket.data.userName,
        x: data.x,
        y: data.y,
      });
    });

    socket.on('join-team-metrics', (teamId: string) => {
      if (!socket.data.teamIds.includes(teamId)) return;
      socket.join(`metrics:${teamId}`);
    });

    socket.on('leave-team-metrics', (teamId: string) => {
      socket.leave(`metrics:${teamId}`);
    });

    socket.on('disconnect', () => {
      for (const [dashboardId, room] of dashboardRooms.entries()) {
        if (room.has(socket.data.userId)) {
          room.delete(socket.data.userId);
          io.to(`dashboard:${dashboardId}`).emit('collaborators', Array.from(room.values()));
        }
      }
    });
  });

  return io;
}

export async function startMetricsSimulator(io: Server) {
  const teams = await pool.query('SELECT id FROM teams');

  setInterval(async () => {
    for (const team of teams.rows) {
      const teamId = team.id;
      const metrics = await pool.query(
        `SELECT DISTINCT metric_key FROM metric_data_points WHERE team_id = $1`,
        [teamId]
      );

      for (const m of metrics.rows) {
        const last = await pool.query(
          `SELECT value FROM metric_data_points
           WHERE team_id = $1 AND metric_key = $2
           ORDER BY recorded_at DESC LIMIT 1`,
          [teamId, m.metric_key]
        );

        const base = last.rows.length > 0 ? parseFloat(last.rows[0].value) : 100;
        const variance = base * 0.1;
        const newValue = Math.round((base + (Math.random() - 0.5) * variance * 2) * 100) / 100;

        // Occasionally inject anomaly
        const isAnomalyInjection = Math.random() < 0.02;
        const value = isAnomalyInjection ? base * (Math.random() > 0.5 ? 3 : 0.1) : newValue;

        await pool.query(
          `INSERT INTO metric_data_points (team_id, metric_key, value) VALUES ($1, $2, $3)`,
          [teamId, m.metric_key, value]
        );

        io.to(`metrics:${teamId}`).emit('metric-update', {
          teamId,
          metric_key: m.metric_key,
          value,
          recorded_at: new Date().toISOString(),
        });
      }

      // Check anomalies
      const anomalies = await checkAnomalies(teamId);
      if (anomalies.length > 0) {
        io.to(`metrics:${teamId}`).emit('anomaly-detected', { teamId, anomalies });
        for (const anomaly of anomalies) {
          await deliverWebhook(teamId, 'metric.anomaly', {
            metric_key: anomaly.metric_key,
            stats: anomaly.stats,
          });
        }
      }
    }
  }, 5000);
}
