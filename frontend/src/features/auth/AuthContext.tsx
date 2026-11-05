import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { authStore, refreshSession, type User } from './auth';
import { demoMode } from '../rides/api';

const AuthContext = createContext<{ user: User | null; loading: boolean } | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(authStore.subscribe, authStore.snapshot, () => null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (demoMode) { setLoading(false); return; }
    let active = true;
    refreshSession().catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="page" role="status">Restoring your session…</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
