import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, apiFetch } from '../constants/api';
import { installSessionGuard, setSessionExpiredHandler } from '../lib/sessionGuard';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  systemRole: string;
  societyRole: string;
  societyId: string | null;
  wingId: string | null;
  flatNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  isVerified: boolean;
  /** Uploaded profile photo, when the resident has set one. */
  avatar?: string | null;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  /**
   * What this user is allowed to do, fetched from the backend rather than
   * re-derived here. Screens used to keep their own copy of the role rules,
   * which drifted from the routes and left buttons on screen that always 403'd.
   */
  permissions: string[];
}

interface AuthContextType extends AuthState {
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  /** True when the backend says this user holds the permission. */
  can: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, loading: true, permissions: [] });

  // Rehydrate from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const raw   = await AsyncStorage.getItem('user');
        const user: UserProfile | null = raw ? JSON.parse(raw) : null;
        setState({ token, user, loading: false, permissions: [] });
        if (token) loadPermissions(token);
      } catch {
        setState({ token: null, user: null, loading: false, permissions: [] });
      }
    })();
  }, []);

  // Kept out of the render path: a failure here must never block sign-in, it
  // just means the user sees fewer buttons until the next refresh.
  const loadPermissions = useCallback(async (token: string) => {
    try {
      const json = await apiFetch(API.MY_PERMISSIONS, {}, token);
      const list = Array.isArray(json?.data?.permissions) ? json.data.permissions : [];
      setState((prev) => ({ ...prev, permissions: list }));
    } catch {
      setState((prev) => ({ ...prev, permissions: [] }));
    }
  }, []);

  const login = useCallback(async (token: string, user: UserProfile) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setState({ token, user, loading: false, permissions: [] });
    await loadPermissions(token);
  }, [loadPermissions]);

  // A 401 from any authenticated call means the session is over. Clear it and
  // let AuthGate route to login, instead of leaving the user on a screen whose
  // Retry button can never work.
  useEffect(() => {
    installSessionGuard();
  }, []);

  const logout = useCallback(async () => {
    // Stop pushing to this device before dropping the session.
    try {
      const token = await AsyncStorage.getItem('token');
      // On web there is no expoPushToken — unregisterPush reads the browser's
      // saved endpoint instead, so it must still run when that value is absent.
      const expoToken = await AsyncStorage.getItem('expoPushToken');
      if (token) {
        const { unregisterPush } = await import('../lib/push');
        await unregisterPush(token, expoToken);
      }
      await AsyncStorage.removeItem('expoPushToken');
    } catch { /* best effort */ }

    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setState({ token: null, user: null, loading: false, permissions: [] });
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(async () => {
      // Only meaningful if we thought we were signed in.
      if (!state.token) return;
      await AsyncStorage.setItem('sessionExpired', '1');
      await logout();
    });
    return () => setSessionExpiredHandler(null);
  }, [state.token, logout]);

  const can = useCallback(
    (permission: string) => state.permissions.includes(permission),
    [state.permissions],
  );

  const refreshPermissions = useCallback(async () => {
    if (state.token) await loadPermissions(state.token);
  }, [state.token, loadPermissions]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, can, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * Permission names, mirroring backend/config/permissions.js. Only used to keep
 * the strings honest at the call sites — the backend decides who holds what.
 */
export const PERM = {
  MEMBERS_VIEW: 'members.view',
  MEMBERS_APPROVE: 'members.approve',
  MEMBERS_ROLES: 'members.roles',
  ELECTIONS_MANAGE: 'elections.manage',
  FINANCE_MANAGE: 'finance.manage',
  FINANCE_VERIFY: 'finance.verify',
  NOTICES_MANAGE: 'notices.manage',
  EVENTS_MANAGE: 'events.manage',
  AMENITIES_MANAGE: 'amenities.manage',
  PARKING_MANAGE: 'parking.manage',
  COMPLAINTS_MANAGE: 'complaints.manage',
  HELPLINE_MANAGE: 'helpline.manage',
  MAP_MANAGE: 'map.manage',
  SECURITY_MANAGE: 'security.manage',
  SECURITY_GATE: 'security.gate',
  LOGS_VIEW: 'logs.view',
} as const;

/** Centralised role flags — backend always sends camelCase societyRole. */
export function useRole() {
  const { user, can } = useAuth();
  const role       = user?.societyRole || '';
  const systemRole = user?.systemRole || '';

  const isSecretary  = role === 'secretary';
  const isTreasurer  = role === 'treasurer';
  const isCommittee  = role === 'committee_member';
  const isChairman   = role === 'chairman';
  const isSecurity   = role === 'security';          // gate/security guard
  const isSuperAdmin = systemRole === 'superadmin';

  /** Can approve members, create notices, events, funds, expenses */
  const isAdmin   = isSecretary || isTreasurer || isCommittee || isChairman || isSuperAdmin;
  /** Can create/edit notices, events, funds, expenses */
  const isManager = isSecretary || isTreasurer || isChairman || isSuperAdmin;
  /** Can work the gate: visitors, staff attendance, respond to SOS */
  const isGateStaff = isSecurity || isAdmin;

  return {
    isSecretary, isTreasurer, isCommittee, isChairman, isSecurity, isSuperAdmin,
    isAdmin, isManager, isGateStaff, role, systemRole,
    /**
     * Prefer this over the role flags above. The flags are a rough grouping
     * kept for existing screens; `can` is what the backend will actually
     * enforce, so a button gated on it never 403s.
     */
    can,
  };
}
