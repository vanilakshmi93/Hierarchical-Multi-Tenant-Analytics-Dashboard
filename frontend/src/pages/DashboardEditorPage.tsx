import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getSocket } from '../socket';
import type { Dashboard, Widget, Collaborator, MetricPoint } from '../types';
import { MetricWidget, ChartWidget } from '../components/widgets/MetricWidget';
import { ArrowLeft, Plus, Users, Trash2 } from 'lucide-react';

const METRIC_OPTIONS = [
  { key: 'revenue', label: 'Revenue', unit: '$' },
  { key: 'page_views', label: 'Page Views' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'errors', label: 'Errors' },
  { key: 'users', label: 'Users' },
];

export default function DashboardEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { currentTeam, canWrite } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [chartData, setChartData] = useState<Record<string, Array<{ recorded_at: string; value: number }>>>({});
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!id) return;
    const data = await api.getDashboard(id) as Dashboard & { widgets: Widget[] };
    setDashboard(data);
    setWidgets(data.widgets || []);
    setLoading(false);
  }, [id]);

  const loadMetrics = useCallback(async () => {
    if (!currentTeam) return;
    const latest = await api.getLatestMetrics(currentTeam.team_id) as MetricPoint[];
    const map: Record<string, number> = {};
    latest.forEach((m) => { map[m.metric_key] = m.value; });
    setMetrics(map);

    const chartKeys = [...new Set(widgets.filter((w) => w.widget_type === 'chart').map((w) => w.metric_key).filter(Boolean))];
    const charts: Record<string, Array<{ recorded_at: string; value: number }>> = {};
    for (const key of chartKeys) {
      if (key) charts[key] = await api.getMetricHistory(currentTeam.team_id, key) as Array<{ recorded_at: string; value: number }>;
    }
    setChartData(charts);
  }, [currentTeam, widgets]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (widgets.length > 0) loadMetrics(); }, [widgets, loadMetrics]);

  useEffect(() => {
    if (!id || !currentTeam) return;
    const socket = getSocket();

    socket.emit('join-dashboard', id);
    socket.emit('join-team-metrics', currentTeam.team_id);

    socket.on('collaborators', setCollaborators);
    socket.on('widget-updated', (data: { widgetId: string; changes: Partial<Widget> }) => {
      setWidgets((prev) => prev.map((w) => w.id === data.widgetId ? { ...w, ...data.changes } : w));
    });
    socket.on('widget-positioned', (data: { widgetId: string; position: Widget['position'] }) => {
      setWidgets((prev) => prev.map((w) => w.id === data.widgetId ? { ...w, position: data.position } : w));
    });
    socket.on('widget-added', (data: { widget: Widget }) => {
      setWidgets((prev) => [...prev, data.widget]);
    });
    socket.on('widget-deleted', (data: { widgetId: string }) => {
      setWidgets((prev) => prev.filter((w) => w.id !== data.widgetId));
    });
    socket.on('metric-update', (data: { metric_key: string; value: number }) => {
      setMetrics((prev) => ({ ...prev, [data.metric_key]: data.value }));
      setChartData((prev) => {
        const key = data.metric_key;
        if (!prev[key]) return prev;
        return {
          ...prev,
          [key]: [...prev[key].slice(-23), { recorded_at: new Date().toISOString(), value: data.value }],
        };
      });
    });

    return () => {
      socket.emit('leave-dashboard', id);
      socket.emit('leave-team-metrics', currentTeam.team_id);
      socket.off('collaborators');
      socket.off('widget-updated');
      socket.off('widget-positioned');
      socket.off('widget-added');
      socket.off('widget-deleted');
      socket.off('metric-update');
    };
  }, [id, currentTeam]);

  const handleLayoutChange = (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    if (!canWrite || !id) return;
    const socket = getSocket();

    layout.forEach((item) => {
      const widget = widgets.find((w) => w.id === item.i);
      if (!widget) return;
      const newPos = { x: item.x, y: item.y, w: item.w, h: item.h };
      if (JSON.stringify(widget.position) !== JSON.stringify(newPos)) {
        api.updateWidget(id, item.i, { position: newPos }).catch(() => {});
        socket.emit('widget-position', { dashboardId: id, widgetId: item.i, position: newPos });
        setWidgets((prev) => prev.map((w) => w.id === item.i ? { ...w, position: newPos } : w));
      }
    });
  };

  const handleAddWidget = async (type: string, metricKey: string) => {
    if (!id || !canWrite) return;
    const metric = METRIC_OPTIONS.find((m) => m.key === metricKey);
    const position = { x: 0, y: Infinity, w: type === 'chart' ? 8 : 4, h: type === 'chart' ? 3 : 2 };

    const widget = await api.addWidget(id, {
      widget_type: type,
      title: metric?.label || metricKey,
      metric_key: metricKey,
      position,
    }) as Widget;

    setWidgets((prev) => [...prev, widget]);
    getSocket().emit('widget-add', { dashboardId: id, widget });
    setShowAddWidget(false);
    loadMetrics();
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!id || !canWrite) return;
    await api.deleteWidget(id, widgetId);
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    getSocket().emit('widget-delete', { dashboardId: id, widgetId });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  if (!dashboard) return <div className="p-8 text-center text-gray-500">Dashboard not found</div>;

  const layout = widgets.map((w) => ({
    i: w.id,
    x: w.position?.x ?? 0,
    y: w.position?.y ?? 0,
    w: w.position?.w ?? 4,
    h: w.position?.h ?? 2,
    minW: 2,
    minH: 2,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{dashboard.name}</h1>
            <p className="text-sm text-gray-500">{currentTeam?.team_name} · {canWrite ? 'Editing' : 'View only'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {collaborators.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-400" />
              {collaborators.map((c) => (
                <span
                  key={c.userId}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-medium"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                >
                  {c.name[0]}
                </span>
              ))}
            </div>
          )}
          {canWrite && (
            <button
              onClick={() => setShowAddWidget(!showAddWidget)}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" /> Add Widget
            </button>
          )}
        </div>
      </div>

      {showAddWidget && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium mb-3">Add a widget</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {METRIC_OPTIONS.map((m) => (
              <div key={m.key} className="space-y-1">
                <button
                  onClick={() => handleAddWidget('metric', m.key)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg border border-gray-200"
                >
                  {m.label} (Metric)
                </button>
                <button
                  onClick={() => handleAddWidget('chart', m.key)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg border border-gray-200"
                >
                  {m.label} (Chart)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef}>
        {widgets.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No widgets yet</p>
            {canWrite && <p className="text-sm mt-1">Click "Add Widget" to start building your dashboard</p>}
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={containerWidth}
            onLayoutChange={handleLayoutChange}
            isDraggable={canWrite}
            isResizable={canWrite}
            draggableHandle=".drag-handle"
            compactType="vertical"
          >
            {widgets.map((widget) => (
              <div key={widget.id} className="relative group">
                {canWrite && (
                  <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => handleDeleteWidget(widget.id)}
                      className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className={`h-full drag-handle ${canWrite ? 'cursor-move' : ''}`}>
                  {widget.widget_type === 'chart' ? (
                    <ChartWidget
                      title={widget.title}
                      data={chartData[widget.metric_key || ''] || []}
                    />
                  ) : (
                    <MetricWidget
                      title={widget.title}
                      value={widget.metric_key ? metrics[widget.metric_key] ?? null : null}
                      unit={METRIC_OPTIONS.find((m) => m.key === widget.metric_key)?.unit}
                    />
                  )}
                </div>
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  );
}
