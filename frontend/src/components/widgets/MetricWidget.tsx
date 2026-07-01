import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricWidgetProps {
  title: string;
  value: number | null;
  unit?: string;
  isAnomaly?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricWidget({ title, value, unit, isAnomaly, trend }: MetricWidgetProps) {
  return (
    <div className={`h-full bg-white rounded-xl border p-4 flex flex-col justify-between ${isAnomaly ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {isAnomaly && <AlertTriangle className="w-4 h-4 text-red-500" />}
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-2">
        {value !== null ? (unit === '$' ? `$${value.toLocaleString()}` : value.toLocaleString()) : '—'}
        {unit && unit !== '$' && <span className="text-lg text-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

interface ChartWidgetProps {
  title: string;
  data: Array<{ recorded_at: string; value: number }>;
  color?: string;
}

export function ChartWidget({ title, data, color = '#3b82f6' }: ChartWidgetProps) {
  const formatted = data.map((d) => ({
    time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }));

  return (
    <div className="h-full bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
      <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted}>
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={50} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
