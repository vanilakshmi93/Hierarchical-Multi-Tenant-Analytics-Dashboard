import { Router, Request, Response } from 'express';
import { authenticate, requireTeamAccess, requirePermission } from '../middleware/auth';
import { pool } from '../db/pool';
import { rlsQuery, logAudit } from '../services/audit';

const router = Router();

router.use(authenticate);

router.get('/team/:teamId', requireTeamAccess('teamId'), async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT d.*, u.name as created_by_name
       FROM dashboards d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.team_id = $1
       ORDER BY d.updated_at DESC`,
      [teamId]
    );
  });
  res.json(result.rows);
});

router.get('/:dashboardId', async (req: Request, res: Response) => {
  const { dashboardId } = req.params as { dashboardId: string };
  const dashResult = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT * FROM dashboards WHERE id = $1', [dashboardId]);
  });

  if (dashResult.rows.length === 0) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const dashboard = dashResult.rows[0];
  const widgets = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      'SELECT * FROM dashboard_widgets WHERE dashboard_id = $1 ORDER BY created_at',
      [dashboardId]
    );
  });

  await logAudit(req.user!.userId, dashboard.team_id, 'read', 'dashboard', dashboardId, {}, req.ip);
  res.json({ ...dashboard, widgets: widgets.rows });
});

router.post('/team/:teamId', requireTeamAccess('teamId'), requirePermission('write'), async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  const { name, description, project_id } = req.body;

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `INSERT INTO dashboards (team_id, project_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [teamId, project_id || null, name, description || null, req.user!.userId]
    );
  });

  await logAudit(req.user!.userId, teamId, 'create', 'dashboard', result.rows[0].id, { name }, req.ip);
  res.status(201).json(result.rows[0]);
});

router.put('/:dashboardId', async (req: Request, res: Response) => {
  const { dashboardId } = req.params as { dashboardId: string };
  const { name, description, layout } = req.body;

  const existing = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT * FROM dashboards WHERE id = $1', [dashboardId]);
  });
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const teamId = existing.rows[0].team_id;
  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user!.userId]
  );
  const role = roleResult.rows[0]?.role;
  if (!role || role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `UPDATE dashboards SET name = COALESCE($2, name), description = COALESCE($3, description),
              layout = COALESCE($4, layout), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [dashboardId, name, description, layout ? JSON.stringify(layout) : null]
    );
  });

  await logAudit(req.user!.userId, teamId, 'update', 'dashboard', dashboardId, { name }, req.ip);
  res.json(result.rows[0]);
});

router.delete('/:dashboardId', async (req: Request, res: Response) => {
  const { dashboardId } = req.params as { dashboardId: string };
  const existing = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT team_id FROM dashboards WHERE id = $1', [dashboardId]);
  });
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const teamId = existing.rows[0].team_id;
  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user!.userId]
  );
  if (roleResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('DELETE FROM dashboards WHERE id = $1', [dashboardId]);
  });

  await logAudit(req.user!.userId, teamId, 'delete', 'dashboard', dashboardId, {}, req.ip);
  res.status(204).send();
});

// Widgets
router.post('/:dashboardId/widgets', async (req: Request, res: Response) => {
  const { dashboardId } = req.params as { dashboardId: string };
  const { widget_type, title, metric_key, config, position } = req.body;

  const dash = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT team_id FROM dashboards WHERE id = $1', [dashboardId]);
  });
  if (dash.rows.length === 0) return res.status(404).json({ error: 'Dashboard not found' });

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [dash.rows[0].team_id, req.user!.userId]
  );
  if (!roleResult.rows[0] || roleResult.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, metric_key, config, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [dashboardId, widget_type, title, metric_key, JSON.stringify(config || {}), JSON.stringify(position)]
    );
  });

  res.status(201).json(result.rows[0]);
});

router.put('/:dashboardId/widgets/:widgetId', async (req: Request, res: Response) => {
  const { dashboardId, widgetId } = req.params as { dashboardId: string; widgetId: string };
  const { title, metric_key, config, position } = req.body;

  const dash = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT team_id FROM dashboards WHERE id = $1', [dashboardId]);
  });
  if (dash.rows.length === 0) return res.status(404).json({ error: 'Dashboard not found' });

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [dash.rows[0].team_id, req.user!.userId]
  );
  if (!roleResult.rows[0] || roleResult.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `UPDATE dashboard_widgets
       SET title = COALESCE($2, title), metric_key = COALESCE($3, metric_key),
           config = COALESCE($4, config), position = COALESCE($5, position), updated_at = NOW()
       WHERE id = $1 AND dashboard_id = $6 RETURNING *`,
      [widgetId, title, metric_key, config ? JSON.stringify(config) : null, position ? JSON.stringify(position) : null, dashboardId]
    );
  });

  if (result.rows.length === 0) return res.status(404).json({ error: 'Widget not found' });
  res.json(result.rows[0]);
});

router.delete('/:dashboardId/widgets/:widgetId', async (req: Request, res: Response) => {
  const { dashboardId, widgetId } = req.params;

  const dash = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT team_id FROM dashboards WHERE id = $1', [dashboardId]);
  });
  if (dash.rows.length === 0) return res.status(404).json({ error: 'Dashboard not found' });

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [dash.rows[0].team_id, req.user!.userId]
  );
  if (!roleResult.rows[0] || roleResult.rows[0].role === 'viewer') {
    return res.status(403).json({ error: 'Write permission required' });
  }

  await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('DELETE FROM dashboard_widgets WHERE id = $1 AND dashboard_id = $2', [widgetId, dashboardId]);
  });

  res.status(204).send();
});

export default router;
