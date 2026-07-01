const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string }; teams: unknown[] }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  me: () => request<{ user: { id: string; email: string; name: string }; teams: unknown[] }>('/auth/me'),

  getTeams: () => request<unknown[]>('/org/teams'),

  getProjects: (teamId: string) => request<unknown[]>(`/org/teams/${teamId}/projects`),

  getDashboards: (teamId: string) => request<unknown[]>(`/dashboards/team/${teamId}`),

  getDashboard: (id: string) => request<unknown>(`/dashboards/${id}`),

  createDashboard: (teamId: string, data: { name: string; description?: string; project_id?: string | null }) =>
    request<unknown>(`/dashboards/team/${teamId}`, { method: 'POST', body: JSON.stringify(data) }),

  updateDashboard: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  addWidget: (dashboardId: string, widget: Record<string, unknown>) =>
    request<unknown>(`/dashboards/${dashboardId}/widgets`, { method: 'POST', body: JSON.stringify(widget) }),

  updateWidget: (dashboardId: string, widgetId: string, data: Record<string, unknown>) =>
    request<unknown>(`/dashboards/${dashboardId}/widgets/${widgetId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteWidget: (dashboardId: string, widgetId: string) =>
    request<void>(`/dashboards/${dashboardId}/widgets/${widgetId}`, { method: 'DELETE' }),

  getLatestMetrics: (teamId: string) => request<unknown[]>(`/metrics/team/${teamId}/latest`),

  getMetricHistory: (teamId: string, metricKey: string, hours = 24) =>
    request<unknown[]>(`/metrics/team/${teamId}/${metricKey}/history?hours=${hours}`),

  getKpis: (teamId: string) => request<unknown[]>(`/metrics/team/${teamId}/kpis`),

  getAnomalies: (teamId: string) => request<unknown[]>(`/metrics/team/${teamId}/anomalies`),

  getAuditLogs: (teamId: string) => request<unknown[]>(`/audit/team/${teamId}`),

  getWebhooks: (teamId: string) => request<unknown[]>(`/webhooks/team/${teamId}`),

  createWebhook: (teamId: string, url: string, events: string[]) =>
    request<unknown>(`/webhooks/team/${teamId}`, {
      method: 'POST',
      body: JSON.stringify({ url, events, secret: Math.random().toString(36).slice(2) }),
    }),

  deleteWebhook: (webhookId: string) =>
    request<void>(`/webhooks/${webhookId}`, { method: 'DELETE' }),

  getCustomMetrics: (teamId: string) => request<unknown[]>(`/metrics/team/${teamId}/custom`),

  createCustomMetric: (teamId: string, data: { name: string; metric_key: string; description?: string; unit?: string }) =>
    request<unknown>(`/metrics/team/${teamId}/custom`, { method: 'POST', body: JSON.stringify(data) }),
};
