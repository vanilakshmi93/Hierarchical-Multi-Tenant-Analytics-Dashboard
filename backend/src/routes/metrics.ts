import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import { rlsQuery, logAudit } from '../services/audit';
import { getMetricStats, checkAnomalies, calculateKpi } from '../services/metrics';

const router = Router();

router.use(authenticate);

router.get('/team/:teamId/latest', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT DISTINCT ON (metric_key) metric_key, value, recorded_at
       FROM metric_data_points
       WHERE team_id = $1
       ORDER BY metric_key, recorded_at DESC`,
      [teamId]
    );
  });

  res.json(result.rows);
});

router.get('/team/:teamId/:metricKey/history', async (req: Request, res: Response) => {
  const { teamId, metricKey } = req.params as { teamId: string; metricKey: string };
  const hours = parseInt(req.query.hours as string) || 24;

  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT value, recorded_at FROM metric_data_points
       WHERE team_id = $1 AND metric_key = $2
         AND recorded_at > NOW() - INTERVAL '1 hour' * $3
       ORDER BY recorded_at ASC`,
      [teamId, metricKey, hours]
    );
  });

  await logAudit(req.user!.userId, teamId, 'read', 'metrics', metricKey, {}, req.ip);
  res.json(result.rows);
});

router.get('/team/:teamId/:metricKey/stats', async (req: Request, res: Response) => {
  const { teamId, metricKey } = req.params as { teamId: string; metricKey: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const stats = await getMetricStats(teamId, metricKey);
  res.json(stats);
});

router.get('/team/:teamId/anomalies', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const anomalies = await checkAnomalies(teamId);
  res.json(anomalies);
});

// KPIs
router.get('/team/:teamId/kpis', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const kpis = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT * FROM kpi_definitions WHERE team_id = $1', [teamId]);
  });

  const results = [];
  for (const kpi of kpis.rows) {
    const value = await calculateKpi(teamId, kpi.numerator_metric, kpi.denominator_metric);
    results.push({ ...kpi, current_value: value });
  }
  res.json(results);
});

router.post('/team/:teamId/kpis', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  const { name, formula, numerator_metric, denominator_metric } = req.body;

  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user!.userId]
  );
  if (!roleResult.rows[0] || roleResult.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `INSERT INTO kpi_definitions (team_id, name, formula, numerator_metric, denominator_metric, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teamId, name, formula, numerator_metric, denominator_metric, req.user!.userId]
    );
  });

  res.status(201).json(result.rows[0]);
});

// Custom metrics (Tier 3)
router.get('/team/:teamId/custom', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT * FROM custom_metrics WHERE team_id = $1', [teamId]);
  });
  res.json(result.rows);
});

router.post('/team/:teamId/custom', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  const { name, metric_key, description, unit } = req.body;

  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user!.userId]
  );
  if (!roleResult.rows[0] || roleResult.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `INSERT INTO custom_metrics (team_id, name, metric_key, description, unit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teamId, name, metric_key, description, unit, req.user!.userId]
    );
  });

  res.status(201).json(result.rows[0]);
});

export default router;
