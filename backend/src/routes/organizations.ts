import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import { rlsQuery, logAudit } from '../services/audit';

const router = Router();

router.use(authenticate);

router.get('/organizations', async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT DISTINCT o.id, o.name, o.slug
     FROM organizations o
     JOIN teams t ON t.organization_id = o.id
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = $1`,
    [req.user!.userId]
  );
  res.json(result.rows);
});

router.get('/teams', async (req: Request, res: Response) => {
  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT t.id, t.name, t.slug, t.organization_id, o.name as organization_name,
              tm.role
       FROM teams t
       JOIN organizations o ON o.id = t.organization_id
       JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1`,
      [req.user!.userId]
    );
  });
  res.json(result.rows);
});

router.get('/teams/:teamId/members', async (req: Request, res: Response) => {
  const { teamId } = req.params as { teamId: string };
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT tm.id, tm.role, u.id as user_id, u.name, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1`,
      [teamId]
    );
  });
  res.json(result.rows);
});

router.get('/teams/:teamId/projects', async (req: Request, res: Response) => {
  const { teamId } = req.params;
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query('SELECT * FROM projects WHERE team_id = $1 ORDER BY name', [teamId]);
  });

  await logAudit(req.user!.userId, teamId, 'read', 'projects', teamId, {}, req.ip);
  res.json(result.rows);
});

export default router;
