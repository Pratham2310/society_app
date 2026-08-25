import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

import { api, tokenStore, setUnauthorizedHandler } from "./api";

// =======================================================
// AUTH
//
// The backend puts systemRole and societyRole in the token, and the
// login response returns the user. We keep the user in memory and the
// token in storage — enough to decide navigation without a round trip
// on every render.
//
// Web sessions are 8 hours for superadmin and salesperson. A resident's
// 30 days does not apply here, so expiry is a real case: the API client
// clears the token on 401 and calls back into this.
// =======================================================

export type SystemRole = "superadmin" | "salesperson" | "user";
export type SocietyRole =
  | "chairman" | "secretary" | "treasurer"
  | "committee_member" | "member" | "security";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  systemRole: SystemRole;
  societyRole: SocietyRole;
  societyId: string | null;
  status?: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<User>;
  signOut: () => void;
}

const USER_KEY = "society.console.user";

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // One handler for an expired session, wherever the call came from.
    setUnauthorizedHandler(() => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    });
  }, []);

  const value = useMemo<AuthValue>(() => ({

    user,
    loading,

    async signIn(identifier, password) {

      setLoading(true);

      try {

        const result = await api.post<LoginResponse>(
          "/auth/login",
          { identifier, password },
          { anonymous: true }
        );

        tokenStore.set(result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        setUser(result.user);

        return result.user;

      } finally {
        setLoading(false);
      }

    },

    signOut() {
      tokenStore.clear();
      localStorage.removeItem(USER_KEY);
      setUser(null);
    },

  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// =======================================================
// ROLE HELPERS
//
// Mirrors backend/utils/roles.js. A superadmin is a superset of a
// salesperson there, so it is here too.
// =======================================================

export const isPlatform = (u: User | null) =>
  u?.systemRole === "superadmin" || u?.systemRole === "salesperson";

export const isSuperadmin = (u: User | null) => u?.systemRole === "superadmin";

export const COMMITTEE: SocietyRole[] = [
  "chairman", "secretary", "treasurer", "committee_member",
];

/** Committee members run one society. Platform roles are not committee. */
export const isCommittee = (u: User | null) =>
  !!u && !isPlatform(u) && COMMITTEE.includes(u.societyRole);

export const roleLabel = (u: User | null) => {
  if (!u) return "";
  if (u.systemRole === "superadmin") return "Superadmin";
  if (u.systemRole === "salesperson") return "Salesperson";
  return u.societyRole.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
};
