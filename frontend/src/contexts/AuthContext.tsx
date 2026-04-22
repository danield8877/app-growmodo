import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  apiJson,
  getAccessToken,
  getGuestToken,
  setAccessToken,
  setGuestToken,
} from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface UserProfile {
  id: string;
  role: 'client' | 'professional';
  subscription_plan: 'free' | 'premium' | 'enterprise' | null;
  full_name: string;
  company_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'client' | 'professional'
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyMe = async () => {
    const data = await apiJson<{ user: AuthUser; profile: UserProfile }>('/api/auth/me');
    setUser(data.user);
    setProfile(data.profile);
  };

  useEffect(() => {
    (async () => {
      try {
        if (!getAccessToken()) {
          setLoading(false);
          return;
        }
        await applyMe();
      } catch {
        setAccessToken(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    _role: 'client' | 'professional'
  ) => {
    try {
      const guest_token = getGuestToken();
      const data = await apiJson<{ token: string; user: AuthUser; profile: UserProfile }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            name: fullName,
            ...(guest_token ? { guest_token } : {}),
          }),
        }
      );
      setGuestToken(null);
      setAccessToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Inscription impossible') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const guest_token = getGuestToken();
      const data = await apiJson<{ token: string; user: AuthUser; profile: UserProfile }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            ...(guest_token ? { guest_token } : {}),
          }),
        }
      );
      setGuestToken(null);
      setAccessToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      return { error: null };
    } catch (e) {
      // Jeton invité obsolète (session absente en BDD) → évite les 500 au retry
      setGuestToken(null);
      return { error: e instanceof Error ? e : new Error('Connexion impossible') };
    }
  };

  const signOut = async () => {
    setAccessToken(null);
    setGuestToken(null);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('Non connecté') };
    try {
      if (updates.full_name != null) {
        await apiJson('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({ name: updates.full_name }),
        });
        await applyMe();
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Erreur') };
    }
  };

  const refreshProfile = async () => {
    if (!getAccessToken()) return;
    try {
      await applyMe();
    } catch {
      /* ignore */
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
