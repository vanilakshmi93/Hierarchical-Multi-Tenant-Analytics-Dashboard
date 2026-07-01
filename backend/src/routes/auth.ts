import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name required' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await pool.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const memberships = await pool.query(
    `SELECT tm.team_id, tm.role, t.name as team_name, t.slug as team_slug,
            o.id as organization_id, o.name as organization_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     JOIN organizations o ON o.id = t.organization_id
     WHERE tm.user_id = $1`,
    [user.id]
  );

  const teamIds = memberships.rows.map((m: { team_id: string }) => m.team_id);
  const token = jwt.sign(
    { userId: user.id, email: user.email, teamIds },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  await logAudit(user.id, null, 'login', 'user', user.id, {}, req.ip);

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    teams: memberships.rows,
  });
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const memberships = await pool.query(
    `SELECT tm.team_id, tm.role, t.name as team_name, t.slug as team_slug,
            o.id as organization_id, o.name as organization_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     JOIN organizations o ON o.id = t.organization_id
     WHERE tm.user_id = $1`,
    [req.user!.userId]
  );

  res.json({
    user: { id: req.user!.userId, email: req.user!.email, name: req.user!.name },
    teams: memberships.rows,
  });
});

export default router;
