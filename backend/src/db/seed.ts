import bcrypt from 'bcryptjs';
import { pool } from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = await client.query(`
      INSERT INTO users (email, password_hash, name) VALUES
        ('admin@acme.com', $1, 'Alice Admin'),
        ('editor@acme.com', $1, 'Bob Editor'),
        ('viewer@acme.com', $1, 'Carol Viewer'),
        ('finance@acme.com', $1, 'Dave Finance'),
        ('marketing@acme.com', $1, 'Eve Marketing')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, name
    `, [passwordHash]);

    const allUsers = await client.query('SELECT id, email, name FROM users');
    const userMap = Object.fromEntries(allUsers.rows.map((u: { email: string; id: string }) => [u.email, u.id]));

    // Create organization
    const org = await client.query(`
      INSERT INTO organizations (name, slug) VALUES ('Acme Corp', 'acme')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const orgId = org.rows[0].id;

    // Create teams
    const financeTeam = await client.query(`
      INSERT INTO teams (organization_id, name, slug) VALUES ($1, 'Finance', 'finance')
      ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [orgId]);
    const marketingTeam = await client.query(`
      INSERT INTO teams (organization_id, name, slug) VALUES ($1, 'Marketing', 'marketing')
      ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [orgId]);

    const financeTeamId = financeTeam.rows[0].id;
    const marketingTeamId = marketingTeam.rows[0].id;

    // Create projects (Tier 3)
    await client.query(`
      INSERT INTO projects (team_id, name, slug) VALUES
        ($1, 'Q1 Budget', 'q1-budget'),
        ($1, 'Revenue Tracking', 'revenue-tracking'),
        ($2, 'Campaign Alpha', 'campaign-alpha'),
        ($2, 'Social Media', 'social-media')
      ON CONFLICT (team_id, slug) DO NOTHING
    `, [financeTeamId, marketingTeamId]);

    // Assign team members with roles
    await client.query(`
      INSERT INTO team_members (team_id, user_id, role) VALUES
        ($1, $2, 'admin'),
        ($1, $3, 'editor'),
        ($1, $4, 'viewer'),
        ($1, $5, 'editor'),
        ($6, $2, 'admin'),
        ($6, $7, 'editor'),
        ($6, $3, 'viewer')
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `, [
      financeTeamId, userMap['admin@acme.com'], userMap['editor@acme.com'],
      userMap['viewer@acme.com'], userMap['finance@acme.com'],
      marketingTeamId, userMap['marketing@acme.com']
    ]);

    // Create dashboards
    const financeDash = await client.query(`
      INSERT INTO dashboards (team_id, name, description, created_by)
      VALUES ($1, 'Finance Overview', 'Revenue and error tracking for Finance team', $2)
      RETURNING id
    `, [financeTeamId, userMap['admin@acme.com']]);

    const marketingDash = await client.query(`
      INSERT INTO dashboards (team_id, name, description, created_by)
      VALUES ($1, 'Marketing Dashboard', 'Page views and campaign metrics', $2)
      RETURNING id
    `, [marketingTeamId, userMap['admin@acme.com']]);

    const financeDashId = financeDash.rows[0].id;
    const marketingDashId = marketingDash.rows[0].id;

    // Create widgets
    await client.query(`
      INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, metric_key, position) VALUES
        ($1, 'metric', 'Revenue', 'revenue', '{"x":0,"y":0,"w":4,"h":2}'),
        ($1, 'metric', 'Errors', 'errors', '{"x":4,"y":0,"w":4,"h":2}'),
        ($1, 'chart', 'Revenue Trend', 'revenue', '{"x":0,"y":2,"w":8,"h":3}'),
        ($2, 'metric', 'Page Views', 'page_views', '{"x":0,"y":0,"w":4,"h":2}'),
        ($2, 'metric', 'Clicks', 'clicks', '{"x":4,"y":0,"w":4,"h":2}'),
        ($2, 'chart', 'Traffic Chart', 'page_views', '{"x":0,"y":2,"w":8,"h":3}')
    `, [financeDashId, marketingDashId]);

    // Seed metric data (last 24 hours)
    const metrics = [
      { teamId: financeTeamId, key: 'revenue', base: 50000, variance: 5000 },
      { teamId: financeTeamId, key: 'errors', base: 12, variance: 5 },
      { teamId: financeTeamId, key: 'users', base: 1200, variance: 100 },
      { teamId: marketingTeamId, key: 'page_views', base: 45000, variance: 8000 },
      { teamId: marketingTeamId, key: 'clicks', base: 3200, variance: 600 },
      { teamId: marketingTeamId, key: 'errors', base: 3, variance: 2 },
    ];

    for (const m of metrics) {
      for (let i = 23; i >= 0; i--) {
        const value = m.base + (Math.random() - 0.5) * m.variance * 2;
        await client.query(`
          INSERT INTO metric_data_points (team_id, metric_key, value, recorded_at)
          VALUES ($1, $2, $3, NOW() - INTERVAL '${i} hours')
        `, [m.teamId, m.key, Math.round(value * 100) / 100]);
      }
    }

    // KPI: ARPU = Revenue / Users
    await client.query(`
      INSERT INTO kpi_definitions (team_id, name, formula, numerator_metric, denominator_metric, created_by)
      VALUES ($1, 'ARPU', 'Revenue / Users', 'revenue', 'users', $2)
      ON CONFLICT DO NOTHING
    `, [financeTeamId, userMap['admin@acme.com']]);

    // Anomaly alerts
    await client.query(`
      INSERT INTO anomaly_alerts (team_id, metric_key, threshold_sigma) VALUES
        ($1, 'errors', 2.0),
        ($2, 'page_views', 2.0)
    `, [financeTeamId, marketingTeamId]);

    // Custom metrics
    await client.query(`
      INSERT INTO custom_metrics (team_id, name, metric_key, description, unit, created_by) VALUES
        ($1, 'Conversion Rate', 'conversion_rate', 'Clicks divided by page views', '%', $2),
        ($3, 'Bounce Rate', 'bounce_rate', 'Single page sessions', '%', $4)
    `, [marketingTeamId, userMap['marketing@acme.com'], financeTeamId, userMap['admin@acme.com']]);

    // Sample webhook
    await client.query(`
      INSERT INTO webhooks (team_id, url, events, created_by) VALUES
        ($1, 'https://webhook.site/example', ARRAY['metric.anomaly', 'dashboard.updated'], $2)
    `, [financeTeamId, userMap['admin@acme.com']]);

    await client.query('COMMIT');
    console.log('✅ Seed data created successfully');
    console.log('\n📋 Demo accounts (password: password123):');
    console.log('  admin@acme.com     - Admin (Finance + Marketing)');
    console.log('  editor@acme.com    - Editor (Finance) + Viewer (Marketing)');
    console.log('  viewer@acme.com    - Viewer (Finance only)');
    console.log('  finance@acme.com   - Editor (Finance only)');
    console.log('  marketing@acme.com - Editor (Marketing only)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
