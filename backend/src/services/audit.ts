import { PoolClient } from 'pg';
import { pool, withRlsContext } from '../db/pool';

export async function logAudit(
  userId: string,
  teamId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> = {},
  ip?: string
) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, team_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, teamId, action, resourceType, resourceId, JSON.stringify(details), ip || null]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

export async function rlsQuery<T>(
  userId: string,
  teamIds: string[],
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withRlsContext(userId, teamIds, fn);
}
