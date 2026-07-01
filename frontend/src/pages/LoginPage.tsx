import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Lock } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'admin@acme.com', role: 'Admin', desc: 'Full access to Finance + Marketing' },
  { email: 'editor@acme.com', role: 'Editor', desc: 'Edit Finance, view Marketing' },
  { email: 'viewer@acme.com', role: 'Viewer', desc: 'Read-only Finance access' },
  { email: 'finance@acme.com', role: 'Finance Editor', desc: 'Finance team only' },
  { email: 'marketing@acme.com', role: 'Marketing Editor', desc: 'Marketing team only' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary-600 p-3 rounded-xl">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-500">Hierarchical Multi-Tenant Platform</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> Demo password: <code className="bg-gray-100 px-1 rounded">password123</code>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-600 to-primary-800 p-12 items-center">
        <div className="text-white max-w-lg">
          <h2 className="text-3xl font-bold mb-4">Demo Accounts</h2>
          <p className="text-primary-100 mb-8">Try different roles to see permission enforcement and team data isolation in action.</p>
          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => { setEmail(acc.email); setPassword('password123'); }}
                className="w-full text-left p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-colors backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{acc.email}</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{acc.role}</span>
                </div>
                <p className="text-sm text-primary-200 mt-1">{acc.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
