import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getSocket } from '../socket';
import type { Dashboard, Kpi, Anomaly, AuditLog, Project, Webhook, CustomMetric } from '../types';
import { Plus, LayoutDashboard, AlertTriangle, TrendingUp, Clock, Activity } from 'lucide-react';

export default function DashboardListPage() {
  const { currentTeam, canWrite } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('dashboard.created,dashboard.updated');
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricKey, setNewMetricKey] = useState('');
  const [newMetricDescription, setNewMetricDescription] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentTeam) return;
    setLoading(true);
    Promise.all([
      api.getDashboards(currentTeam.team_id),
      api.getKpis(currentTeam.team_id),
      api.getAnomalies(currentTeam.team_id),
      api.getAuditLogs(currentTeam.team_id),
      api.getProjects(currentTeam.team_id),
      api.getWebhooks(currentTeam.team_id),
      api.getCustomMetrics(currentTeam.team_id),
    ])
      .then(([d, k, a, logs, p, w, cm]) => {
        setDashboards(d as Dashboard[]);
        setKpis(k as Kpi[]);
        setAnomalies(a as Anomaly[]);
        setAuditLogs(logs as AuditLog[]);
        const projectList = p as Project[];
        setProjects(projectList);
        if (!selectedProjectId && projectList.length > 0) {
          setSelectedProjectId(projectList[0].id);
        }
        setWebhooks(w as Webhook[]);
        setCustomMetrics(cm as CustomMetric[]);
      })
      .finally(() => setLoading(false));

    const socket = getSocket();
    socket.emit('join-team-metrics', currentTeam.team_id);
    socket.on('anomaly-detected', (data: { anomalies: Anomaly[] }) => {
      setAnomalies(data.anomalies);
    });

    return () => {
      socket.emit('leave-team-metrics', currentTeam.team_id);
      socket.off('anomaly-detected');
    };
  }, [currentTeam]);

  const refreshTeamData = async () => {
    if (!currentTeam) return;
    const [p, w, cm] = await Promise.all([
      api.getProjects(currentTeam.team_id),
      api.getWebhooks(currentTeam.team_id),
      api.getCustomMetrics(currentTeam.team_id),
    ]);
    const projectList = p as Project[];
    setProjects(projectList);
    if (!selectedProjectId && projectList.length > 0) {
      setSelectedProjectId(projectList[0].id);
    }
    setWebhooks(w as Webhook[]);
    setCustomMetrics(cm as CustomMetric[]);
  };

  const handleCreateWebhook = async () => {
    if (!currentTeam || !newWebhookUrl.trim()) return;
    const webhook = await api.createWebhook(currentTeam.team_id, newWebhookUrl, newWebhookEvents.split(',').map((e) => e.trim()));
    setWebhooks((prev) => [...prev, webhook as Webhook]);
    setNewWebhookUrl('');
    setNewWebhookEvents('dashboard.created,dashboard.updated');
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    await api.deleteWebhook(webhookId);
    setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
  };

  const handleCreateMetric = async () => {
    if (!currentTeam || !newMetricName.trim() || !newMetricKey.trim()) return;
    const metric = await api.createCustomMetric(currentTeam.team_id, {
      name: newMetricName,
      metric_key: newMetricKey,
      description: newMetricDescription,
      unit: newMetricUnit,
    });
    setCustomMetrics((prev) => [...prev, metric as CustomMetric]);
    setNewMetricName('');
    setNewMetricKey('');
    setNewMetricDescription('');
    setNewMetricUnit('');
  };

  const handleCreate = async () => {
    if (!currentTeam || !newName.trim()) return;
    const dash = await api.createDashboard(currentTeam.team_id, {
      name: newName,
      description: undefined,
      project_id: selectedProjectId,
    }) as Dashboard;
    setDashboards([dash, ...dashboards]);
    setNewName('');
    setSelectedProjectId(projects[0]?.id);
    setShowCreate(false);
    navigate(`/dashboard/${dash.id}`);
  };

  if (!currentTeam) return <div className="p-8 text-center text-gray-500">Select a team to continue</div>;
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {anomalies.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle className="w-5 h-5" />
            Anomaly Alerts Detected
          </div>
          {anomalies.map((a, i) => (
            <p key={i} className="text-sm text-red-600">
              <strong>{a.metric_key}</strong>: {a.stats.current.toFixed(2)} deviates {a.stats.sigmaDeviation.toFixed(1)}σ from mean ({a.stats.mean.toFixed(2)})
            </p>
          ))}
        </div>
      )}

      {kpis.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" /> KPIs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-500">{kpi.name}</p>
                <p className="text-2xl font-bold mt-1">
                  {kpi.current_value ? kpi.current_value.value.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">{kpi.formula}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary-600" />
          {currentTeam.team_name} Dashboards
        </h2>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> New Dashboard
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <p className="text-sm font-medium">Create a new dashboard</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Dashboard name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select project (optional)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {dashboards.map((dash) => (
          <button
            key={dash.id}
            onClick={() => navigate(`/dashboard/${dash.id}`)}
            className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-primary-300 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-gray-900">{dash.name}</h3>
            {dash.project_id && <p className="text-xs text-primary-600 mt-1">Project: {projects.find((p) => p.id === dash.project_id)?.name || dash.project_id}</p>}
            {dash.description && <p className="text-sm text-gray-500 mt-1">{dash.description}</p>}
            <p className="text-xs text-gray-400 mt-3">Updated {new Date(dash.updated_at).toLocaleDateString()}</p>
          </button>
        ))}
        {dashboards.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-12">No dashboards yet. {canWrite ? 'Create one to get started!' : 'Ask an editor to create one.'}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Projects</h2>
            <span className="text-xs text-gray-500">{projects.length} project{projects.length === 1 ? '' : 's'}</span>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">No projects are available for this team.</p>
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <li key={project.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium text-gray-800">{project.name}</p>
                  <p className="text-xs text-gray-500">{project.slug}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Webhooks</h2>
            <span className="text-xs text-gray-500">{webhooks.length} configured</span>
          </div>
          {webhooks.length === 0 ? (
            <p className="text-sm text-gray-500">No webhooks configured yet.</p>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800">{webhook.url}</p>
                      <p className="text-xs text-gray-500 mt-1">Events: {Array.isArray(webhook.events) ? webhook.events.join(', ') : webhook.events}</p>
                    </div>
                    {currentTeam.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentTeam.role === 'admin' && (
            <div className="mt-5 pt-5 border-t border-gray-200 space-y-3">
              <p className="text-sm font-medium">Create webhook</p>
              <input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                value={newWebhookEvents}
                onChange={(e) => setNewWebhookEvents(e.target.value)}
                placeholder="dashboard.created,dashboard.updated"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleCreateWebhook}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Add Webhook
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Custom Metrics</h2>
          <span className="text-xs text-gray-500">{customMetrics.length} metric{customMetrics.length === 1 ? '' : 's'}</span>
        </div>
        {customMetrics.length === 0 ? (
          <p className="text-sm text-gray-500">No custom metrics created yet.</p>
        ) : (
          <div className="grid gap-3">
            {customMetrics.map((metric) => (
              <div key={metric.id} className="rounded-lg border border-gray-200 p-3">
                <p className="font-medium text-gray-800">{metric.name}</p>
                <p className="text-xs text-gray-500 mt-1">Key: {metric.metric_key} • Unit: {metric.unit || 'n/a'}</p>
                {metric.description && <p className="text-sm text-gray-500 mt-1">{metric.description}</p>}
              </div>
            ))}
          </div>
        )}

        {canWrite && (
          <div className="mt-5 pt-5 border-t border-gray-200 grid gap-3 sm:grid-cols-2">
            <input
              value={newMetricName}
              onChange={(e) => setNewMetricName(e.target.value)}
              placeholder="Metric name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={newMetricKey}
              onChange={(e) => setNewMetricKey(e.target.value)}
              placeholder="Metric key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={newMetricUnit}
              onChange={(e) => setNewMetricUnit(e.target.value)}
              placeholder="Unit (e.g. $)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={newMetricDescription}
              onChange={(e) => setNewMetricDescription(e.target.value)}
              placeholder="Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleCreateMetric}
              className="sm:col-span-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Create Custom Metric
            </button>
          </div>
        )}
      </div>

      {auditLogs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" /> Recent Activity
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{log.user_name}</span>
                  <span className="text-gray-500">{log.action}</span>
                  <span className="text-gray-400">{log.resource_type}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
