import { pool } from '../db/pool';

export async function deliverWebhook(
  teamId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const webhooks = await pool.query(
    `SELECT id, url, secret FROM webhooks
     WHERE team_id = $1 AND is_active = true AND $2 = ANY(events)`,
    [teamId, eventType]
  );

  for (const webhook of webhooks.rows) {
    try {
      const body = JSON.stringify({ event: eventType, team_id: teamId, ...payload, timestamp: new Date().toISOString() });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        headers['X-Webhook-Secret'] = webhook.secret;
      }

      const response = await fetch(webhook.url, { method: 'POST', headers, body });
      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status_code)
         VALUES ($1, $2, $3, $4)`,
        [webhook.id, eventType, JSON.stringify(payload), response.status]
      );
    } catch (err) {
      console.error(`Webhook delivery failed for ${webhook.url}:`, err);
      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status_code)
         VALUES ($1, $2, $3, $4)`,
        [webhook.id, eventType, JSON.stringify(payload), 0]
      );
    }
  }
}
