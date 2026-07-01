import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BarChart3, LogOut, ChevronDown, Shield, Eye, Edit3 } from 'lucide-react';
import { useState } from 'react';

const roleIcons = { admin: Shield, editor: Edit3, viewer: Eye };
const roleColors = { admin: 'text-purple-600 bg-purple-50', editor: 'text-blue-600 bg-blue-50', viewer: 'text-gray-600 bg-gray-50' };

export default function Layout() {
  const { user, teams, currentTeam, setCurrentTeam, logout } = useAuth();
  const navigate = useNavigate();
  const [showTeams, setShowTeams] = useState(false);

  const RoleIcon = currentTeam ? roleIcons[currentTeam.role] : Eye;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="bg-primary-600 p-2 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h1>
                {currentTeam && (
                  <p className="text-xs text-gray-500">{currentTeam.organization_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowTeams(!showTeams)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                >
                  <span className="font-medium">{currentTeam?.team_name || 'Select Team'}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showTeams && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {teams.map((team) => {
                      const Icon = roleIcons[team.role];
                      return (
                        <button
                          key={team.team_id}
                          onClick={() => { setCurrentTeam(team); setShowTeams(false); navigate('/'); }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between ${
                            currentTeam?.team_id === team.team_id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{team.team_name}</p>
                            <p className="text-xs text-gray-500">{team.organization_name}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${roleColors[team.role]}`}>
                            <Icon className="w-3 h-3" />
                            {team.role}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentTeam && (
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${roleColors[currentTeam.role]}`}>
                    <RoleIcon className="w-3 h-3" />
                    {currentTeam.role}
                  </span>
                )}
                <span className="text-sm text-gray-600">{user?.name}</span>
                <button onClick={logout} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
