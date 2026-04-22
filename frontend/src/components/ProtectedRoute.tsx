import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode, useEffect, useState } from 'react';
import { ensureGuestSession, getGuestToken } from '../lib/api';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si true, une session invité (JWT) suffit quand l’utilisateur n’est pas connecté. */
  allowGuest?: boolean;
}

export default function ProtectedRoute({ children, allowGuest }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [guestReady, setGuestReady] = useState(false);
  const [guestError, setGuestError] = useState(false);

  useEffect(() => {
    if (!allowGuest || user || loading) return;
    if (getGuestToken()) {
      setGuestReady(true);
      return;
    }
    let cancelled = false;
    ensureGuestSession()
      .then(() => {
        if (!cancelled) setGuestReady(true);
      })
      .catch(() => {
        if (!cancelled) setGuestError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [allowGuest, user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  if (allowGuest) {
    if (guestError) {
      return <Navigate to="/login" replace />;
    }
    if (!guestReady) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Préparation de la session…</p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  return <Navigate to="/login" replace />;
}
