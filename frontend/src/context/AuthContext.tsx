import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';
import { connectSocket, disconnectSocket } from '../socket';
import type { User, Team } from '../types';

interface AuthContextType {
  user: User | null;
  teams: Team[];
  currentTeam: Team | null;
  setCurrentTeam: (team: Team) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  canWrite: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me()
        .then((data) => {
          setUser(data.user);
          setTeams(data.teams as Team[]);
          if (data.teams.length > 0) setCurrentTeam(data.teams[0] as Team);
          connectSocket();
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setTeams(data.teams as Team[]);
    if (data.teams.length > 0) setCurrentTeam(data.teams[0] as Team);
    connectSocket();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTeams([]);
    setCurrentTeam(null);
    disconnectSocket();
  };

  const canWrite = currentTeam ? currentTeam.role !== 'viewer' : false;
  const isAdmin = currentTeam?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, teams, currentTeam, setCurrentTeam, login, logout, loading, canWrite, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
