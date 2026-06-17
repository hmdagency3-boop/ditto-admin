import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchUserProfile } from '@/lib/userProfileService';

export type UserRole = 'super_admin' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  avatar_url?: string;
  platform_id?: string;
  externalName?: string;
  externalImage?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null; status?: string }>;
  signUp: (username: string, password: string, fullName: string, deviceFingerprint?: string) => Promise<{ error: Error | null; success?: boolean; username?: string }>;
  signOut: () => void;
  isSuperAdmin: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchCurrentUser(authToken: string) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Fetch external profile data
        const externalData = await fetchUserProfile(userData.platform_id || userData.username || userData.id);
        
        setUser({
          ...userData,
          externalName: externalData?.name,
          externalImage: externalData?.image
        });
      } else {
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(username: string, password: string): Promise<{ error: Error | null; status?: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.message), status: data.status };
      }

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      
      // Fetch external profile data
      const externalData = await fetchUserProfile(data.user.platform_id || data.user.username || data.user.id);
      
      setUser({
        ...data.user,
        externalName: externalData?.name,
        externalImage: externalData?.image
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signUp(username: string, password: string, fullName: string, deviceFingerprint?: string): Promise<{ error: Error | null; success?: boolean; username?: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password, 
          full_name: fullName,
          device_fingerprint: deviceFingerprint || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.message) };
      }

      return { error: null, success: true, username: data.user?.username };
    } catch (error) {
      return { error: error as Error };
    }
  }

  function signOut() {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      isSuperAdmin,
      token,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
