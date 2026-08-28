"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { TOKEN_STORAGE_KEY } from "./config";
import { login as apiLogin, register as apiRegister } from "./api";

/* ------------------------------------------------------------------ */
/* A tiny external store for the JWT, backed by localStorage.          */
/* Using useSyncExternalStore keeps reads SSR-safe and cross-tab       */
/* consistent without a setState-in-effect on mount.                   */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(value: string | null) {
  try {
    if (value) window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

// Any 401 anywhere in the app drops the (now invalid) token.
if (typeof window !== "undefined") {
  window.addEventListener("documind:unauthorized", () => writeToken(null));
}

const HYDRATION_STORE = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};

export interface Auth {
  token: string | null;
  ready: boolean; // true once running in the browser
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): Auth {
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const ready = useSyncExternalStore(
    HYDRATION_STORE.subscribe,
    HYDRATION_STORE.getSnapshot,
    HYDRATION_STORE.getServerSnapshot,
  );

  const login = useCallback(async (username: string, password: string) => {
    writeToken(await apiLogin(username, password));
  }, []);

  const register = useCallback(
    (username: string, email: string, password: string) =>
      apiRegister(username, email, password),
    [],
  );

  const logout = useCallback(() => writeToken(null), []);

  return useMemo(
    () => ({ token, ready, login, register, logout }),
    [token, ready, login, register, logout],
  );
}
