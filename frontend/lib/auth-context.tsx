"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Auth {
  session: Session | null;
  ready: boolean;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  resendSignupCode: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    fail((await supabase.auth.signUp({ email, password })).error);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    fail((await supabase.auth.signInWithPassword({ email, password })).error);
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    fail((await supabase.auth.verifyOtp({ email, token, type: "email" })).error);
  }, []);

  const resendSignupCode = useCallback(async (email: string) => {
    fail((await supabase.auth.resend({ type: "signup", email })).error);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    fail(
      (
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        })
      ).error,
    );
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    fail(
      (
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
      ).error,
    );
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      ready,
      signUpWithPassword,
      signInWithPassword,
      verifySignupOtp,
      resendSignupCode,
      signInWithGoogle,
      sendPasswordReset,
      signOut,
    }),
    [
      session,
      ready,
      signUpWithPassword,
      signInWithPassword,
      verifySignupOtp,
      resendSignupCode,
      signInWithGoogle,
      sendPasswordReset,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The current Supabase access token (for the API client), or null. */
export function useAccessToken(): string | null {
  return useAuth().session?.access_token ?? null;
}
