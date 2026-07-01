import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { AuthPayload, UserRole, hasPermission } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload & { name: string };
      teamRole?: UserRole;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;

    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [payload.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const memberships = await pool.query(
      `SELECT team_id FROM team_members WHERE user_id = $1`,
      [payload.userId]
    );
    const teamIds = memberships.rows.map((r: { team_id: string }) => r.team_id);

    req.user = {
      ...payload,
      teamIds,
      name: userResult.rows[0].name,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireTeamAccess(teamIdParam = 'teamId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const teamId = (req.params[teamIdParam] || req.body.team_id || req.query.team_id) as string | undefined;
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required' });
    }

    if (!req.user?.teamIds.includes(teamId)) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    const roleResult = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    req.teamRole = roleResult.rows[0]?.role as UserRole;
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.teamRole || !hasPermission(req.teamRole, permission)) {
      return res.status(403).json({ error: `Permission '${permission}' required` });
    }
    next();
  };
}
