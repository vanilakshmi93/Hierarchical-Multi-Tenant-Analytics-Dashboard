export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface TeamMembership {
  team_id: string;
  team_name: string;
  team_slug: string;
  organization_id: string;
  organization_name: string;
  role: UserRole;
}

export interface AuthPayload {
  userId: string;
  email: string;
  teamIds: string[];
}

export interface Dashboard {
  id: string;
  team_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  layout: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  metric_key: string | null;
  kpi_id: string | null;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface MetricDataPoint {
  metric_key: string;
  value: number;
  recorded_at: string;
}

export interface KpiDefinition {
  id: string;
  team_id: string;
  name: string;
  formula: string;
  numerator_metric: string;
  denominator_metric: string;
}

export interface AnomalyAlert {
  id: string;
  team_id: string;
  metric_key: string;
  threshold_sigma: number;
  is_active: boolean;
  last_triggered_at: string | null;
}

export interface Webhook {
  id: string;
  team_id: string;
  url: string;
  events: string[];
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  team_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  slug: string;
}

export interface CustomMetric {
  id: string;
  team_id: string;
  name: string;
  metric_key: string;
  description: string | null;
  unit: string | null;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['read', 'write', 'delete', 'manage_members', 'manage_webhooks'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
