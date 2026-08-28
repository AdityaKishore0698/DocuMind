"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ChatMessageItem,
  ChatSessionItem,
  getSessionMessages,
  listSessions,
} from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";

export default function AppShell() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshSessions = useCallback(async () => {
    if (!token) return;
    try {
      setSessions(await listSessions(token));
    } catch {
      /* handled globally on 401 */
    }
  }, [token]);

  useEffect(() => {
    // Initial load — state is set only after the request resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSessions();
  }, [refreshSessions]);

  const openSession = useCallback(
    async (id: number) => {
      if (!token) return;
      setActiveSessionId(id);
      setSidebarOpen(false);
      try {
        setMessages(await getSessionMessages(token, id));
      } catch {
        setMessages([]);
      }
    },
    [token],
  );

  const newChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  const handleSessionCreated = useCallback(
    (id: number) => {
      setActiveSessionId(id);
      refreshSessions();
    },
    [refreshSessions],
  );

  const handleSessionRemoved = useCallback(
    (id: number) => {
      if (id === activeSessionId) newChat();
      refreshSessions();
    },
    [activeSessionId, newChat, refreshSessions],
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onOpenSession={openSession}
        onSessionsChanged={refreshSessions}
        onSessionRemoved={handleSessionRemoved}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatPanel
          key={activeSessionId ?? "new"}
          activeSessionId={activeSessionId}
          messages={messages}
          setMessages={setMessages}
          onSessionCreated={handleSessionCreated}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </main>
    </div>
  );
}
