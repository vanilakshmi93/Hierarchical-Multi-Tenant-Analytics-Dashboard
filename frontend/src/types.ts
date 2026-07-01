export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Team {
  team_id: string;
  team_name: string;
  team_slug: string;
  organization_id: string;
  organization_name: string;
  role: UserRole;
}

export interface Dashboard {
  id: string;
  team_id: string;
  project_id?: string | null;
  name: string;
  description: string | null;
  created_by_name?: string;
  updated_at: string;
  widgets?: Widget[];
}

export interface Widget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  metric_key: string | null;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface MetricPoint {
  metric_key: string;
  value: number;
  recorded_at: string;
}

export interface Kpi {
  id: string;
  name: string;
  formula: string;
  numerator_metric: string;
  denominator_metric: string;
  current_value?: { value: number; numerator: number; denominator: number };
}

export interface Anomaly {
  metric_key: string;
  stats: {
    mean: number;
    stdDev: number;
    current: number;
    isAnomaly: boolean;
    sigmaDeviation: number;
  };
}

export interface Collaborator {
  userId: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  slug: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface CustomMetric {
  id: string;
  name: string;
  metric_key: string;
  description: string | null;
  unit: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  user_name: string;
  created_at: string;
  details: Record<string, unknown>;
}
