import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db/pool';
import { rlsQuery, logAudit } from '../services/audit';

const router = Router();

router.use(authenticate);

router.get('/team/:teamId', async (req: Request, res: Response) => {
  const { teamId } = req.params;
  if (!req.user!.teamIds.includes(teamId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await rlsQuery(req.user!.userId, req.user!.teamIds, async (client) => {
    return client.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.team_id = $1
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [teamId]
    );
  });

  res.json(result.rows);
});

export default router;
