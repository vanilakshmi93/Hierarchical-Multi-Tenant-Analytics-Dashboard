-- Hierarchical Multi-Tenant Analytics Dashboard Schema with RLS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing objects for clean migration
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS anomaly_alerts CASCADE;
DROP TABLE IF EXISTS kpi_definitions CASCADE;
DROP TABLE IF EXISTS custom_metrics CASCADE;
DROP TABLE IF EXISTS metric_data_points CASCADE;
DROP TABLE IF EXISTS dashboard_widgets CASCADE;
DROP TABLE IF EXISTS dashboards CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams (belong to org)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Projects (belong to team) - Tier 3
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, slug)
);

-- Team members with roles
CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Dashboards
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard widgets
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  metric_key VARCHAR(100),
  kpi_id UUID,
  config JSONB DEFAULT '{}'::jsonb,
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":2}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metric data points (time-series)
CREATE TABLE metric_data_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metric_key VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metric_data_team_key ON metric_data_points(team_id, metric_key, recorded_at DESC);

-- Custom metric definitions - Tier 3
CREATE TABLE custom_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  metric_key VARCHAR(100) NOT NULL,
  description TEXT,
  unit VARCHAR(50),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, metric_key)
);

-- KPI definitions
CREATE TABLE kpi_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  formula VARCHAR(500) NOT NULL,
  numerator_metric VARCHAR(100) NOT NULL,
  denominator_metric VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomaly alerts
CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  metric_key VARCHAR(100) NOT NULL,
  threshold_sigma NUMERIC DEFAULT 2.0,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks - Tier 3
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs - Tier 3
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_team ON audit_logs(team_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's team IDs
CREATE OR REPLACE FUNCTION current_user_team_ids() RETURNS UUID[] AS $$
DECLARE
  team_ids TEXT;
BEGIN
  team_ids := current_setting('app.current_team_ids', true);
  IF team_ids IS NULL OR team_ids = '' THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  RETURN string_to_array(team_ids, ',')::UUID[];
END;
$$ LANGUAGE plpgsql STABLE;

-- Teams: users see only teams they belong to
CREATE POLICY teams_isolation ON teams
  FOR ALL USING (id = ANY(current_user_team_ids()));

-- Projects: users see projects in their teams
CREATE POLICY projects_isolation ON projects
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Team members: see members in own teams
CREATE POLICY team_members_isolation ON team_members
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Dashboards: team isolation
CREATE POLICY dashboards_isolation ON dashboards
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Dashboard widgets: via dashboard team
CREATE POLICY widgets_isolation ON dashboard_widgets
  FOR ALL USING (
    dashboard_id IN (
      SELECT id FROM dashboards WHERE team_id = ANY(current_user_team_ids())
    )
  );

-- Metric data: team isolation
CREATE POLICY metrics_isolation ON metric_data_points
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Custom metrics: team isolation
CREATE POLICY custom_metrics_isolation ON custom_metrics
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- KPI definitions: team isolation
CREATE POLICY kpi_isolation ON kpi_definitions
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Anomaly alerts: team isolation
CREATE POLICY anomaly_isolation ON anomaly_alerts
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Webhooks: team isolation
CREATE POLICY webhooks_isolation ON webhooks
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Audit logs: team isolation
CREATE POLICY audit_isolation ON audit_logs
  FOR ALL USING (team_id = ANY(current_user_team_ids()));

-- Organizations: readable by all authenticated (no RLS needed for org list)
-- Users table: no RLS (auth handled at app level)
