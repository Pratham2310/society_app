import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api, tokenStore, setUnauthorizedHandler } from "./api";

// =======================================================
// SESSION
//
// The token is in SecureStore; the user profile is in AsyncStorage,
// because it is not a secret and reading it synchronously-ish on
// launch avoids a blank frame.
//
// A resident's session lasts 30 days, so the common case is opening
// the app already signed in. Expiry still has to be handled — the API
// client clears the token on 401 and calls back into this.
// =======================================================

export type SocietyRole =
  | "chairman" | "secretary" | "treasurer"
  | "committee_member" | "member" | "security";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  systemRole: "superadmin" | "salesperson" | "user";
  societyRole: SocietyRole;
  societyId: string | null;
  status?: string;
  isVerified?: boolean;
}

interface AuthValue {
  user: User | null;
  /** True until the stored session has been read — hold the splash. */
  restoring: boolean;
  signInWithPassword: (identifier: string, password: string) => Promise<User>;
  setSession: (user: User, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const USER_KEY = "society.user";

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {

    setUnauthorizedHandler(() => {
      AsyncStorage.removeItem(USER_KEY).catch(() => {});
      setUser(null);
    });

    (async () => {
      try {
        const [raw, token] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          tokenStore.get(),
        ]);
        // A profile without a token is a half-signed-out state; treat
        // it as signed out rather than showing a broken session.
        if (raw && token) setUser(JSON.parse(raw) as User);
      } catch {
        // A corrupt profile should not brick the app.
      } finally {
        setRestoring(false);
      }
    })();

  }, []);

  const value = useMemo<AuthValue>(() => ({

    user,
    restoring,

    async setSession(nextUser, token) {
      await tokenStore.set(token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    },

    async signInWithPassword(identifier, password) {

      const result = await api.post<{ user: User; token: string }>(
        "/auth/login",
        { identifier, password },
        { anonymous: true }
      );

      await tokenStore.set(result.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);

      return result.user;

    },

    async signOut() {
      await tokenStore.clear();
      await AsyncStorage.removeItem(USER_KEY).catch(() => {});
      setUser(null);
    },

  }), [user, restoring]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// =======================================================
// ROLE
//
// One app, two faces. A guard sees the gate; everyone else sees their
// home. Two builds would mean two EAS pipelines and two releases for
// what is a different tab set.
// =======================================================

export const isGuard = (u: User | null) => u?.societyRole === "security";

export const isCommittee = (u: User | null) =>
  !!u && ["chairman", "secretary", "treasurer", "committee_member"].includes(u.societyRole);

/** Approved accounts only — the backend refuses everything else anyway. */
export const isApproved = (u: User | null) => u?.status === "approved";
