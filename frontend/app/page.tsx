"use client";

import { useAuth } from "@/lib/auth-context";
import LoginView from "@/components/LoginView";
import AppShell from "@/components/AppShell";

export default function Home() {
  const { session, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return session ? <AppShell /> : <LoginView />;
}
