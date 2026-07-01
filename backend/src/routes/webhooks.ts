import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import { rlsQuery } from '../services/audit';

const router = Router();

router.use(authenticate);

router.get('/team/:teamId', async (req: Request, res: Response) => {
  const { teamId } = req.params;
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT id, url, events, is_active, created_at FROM webhooks WHERE team_id = $1', [teamId]);
  });
  res.json(result.rows);
});

router.post('/team/:teamId', async (req: Request, res: Response) => {
  const { teamId } = req.params;
  const { url, events, secret } = req.body;

  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const roleResult = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user!.userId]
  );
  if (roleResult.rows[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `INSERT INTO webhooks (team_id, url, events, secret, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [teamId, url, events, secret, req.user!.userId]
    );
  });

  res.status(201).json(result.rows[0]);
});

router.delete('/:webhookId', async (req: Request, res: Response) => {
  const { webhookId } = req.params;

  await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('DELETE FROM webhooks WHERE id = $1', [webhookId]);
  });

  res.status(204).send();
});

export default router;
