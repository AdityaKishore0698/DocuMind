"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ChatSessionItem,
  DocumentItem,
  deleteAccount,
  deleteDocument,
  deleteSession,
  listDocuments,
  renameSession,
  uploadDocuments,
} from "@/lib/api";

interface Props {
  sessions: ChatSessionItem[];
  activeSessionId: number | null;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSession: (id: number) => void;
  onSessionsChanged: () => void;
  onSessionRemoved: (id: number) => void;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-500",
  processing: "text-amber-500",
  uploaded: "text-amber-500",
  failed: "text-red-500",
};

export default function Sidebar({
  sessions,
  activeSessionId,
  open,
  onClose,
  onNewChat,
  onOpenSession,
  onSessionsChanged,
  onSessionRemoved,
}: Props) {
  const { token, logout } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocs = useCallback(async () => {
    if (!token) return;
    try {
      setDocs(await listDocuments(token));
    } catch {
      /* 401 handled globally */
    }
  }, [token]);

  useEffect(() => {
    // Initial load — state is set only after the request resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDocs();
  }, [refreshDocs]);

  // Poll while anything is still processing so statuses settle on their own.
  useEffect(() => {
    const pending = docs.some((d) => d.status !== "completed" && d.status !== "failed");
    if (!pending) return;
    const t = setInterval(refreshDocs, 3000);
    return () => clearInterval(t);
  }, [docs, refreshDocs]);

  async function handleFiles(files: FileList | null) {
    if (!token || !files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocuments(token, Array.from(files));
      await refreshDocs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeDoc(id: number) {
    if (!token) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDocument(token, id);
    } finally {
      refreshDocs();
    }
  }

  async function submitRename(id: number) {
    if (!token || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameSession(token, id, renameValue.trim());
      onSessionsChanged();
    } finally {
      setRenamingId(null);
    }
  }

  async function removeSession(id: number) {
    if (!token) return;
    try {
      await deleteSession(token, id);
    } finally {
      onSessionRemoved(id);
    }
  }

  async function handleDeleteAccount() {
    if (!token) return;
    if (
      !window.confirm(
        "Delete your account? This permanently removes all your documents and chats.",
      )
    )
      return;
    try {
      await deleteAccount(token);
    } finally {
      logout();
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-80 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-sm font-semibold tracking-tight">DocuMind</span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted md:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 scrollbar-thin">
          {/* ---------- Documents ---------- */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Knowledge base
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "＋ Upload PDF / TXT"}
            </button>
            {uploadError && (
              <p className="mt-2 text-xs text-red-500">{uploadError}</p>
            )}

            <ul className="mt-3 space-y-1">
              {docs.length === 0 && (
                <li className="px-1 py-2 text-xs text-muted-foreground">
                  No documents yet.
                </li>
              )}
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted"
                >
                  <span className="shrink-0">📄</span>
                  <span className="min-w-0 flex-1 truncate" title={doc.filename}>
                    {doc.filename}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] uppercase ${
                      STATUS_STYLES[doc.status] ?? "text-muted-foreground"
                    }`}
                  >
                    {doc.status}
                  </span>
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- Chat history ---------- */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chats
              </h2>
              <button
                onClick={onNewChat}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-surface-muted"
              >
                ＋ New
              </button>
            </div>

            <ul className="space-y-1">
              {sessions.length === 0 && (
                <li className="px-1 py-2 text-xs text-muted-foreground">
                  No conversations yet.
                </li>
              )}
              {sessions.map((s) => (
                <li key={s.id} className="group">
                  {renamingId === s.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => submitRename(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(s.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full rounded-md border border-primary bg-background px-2 py-1.5 text-sm outline-none"
                    />
                  ) : (
                    <div
                      className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                        activeSessionId === s.id
                          ? "bg-surface-muted font-medium"
                          : "hover:bg-surface-muted"
                      }`}
                    >
                      <button
                        onClick={() => onOpenSession(s.id)}
                        className="min-w-0 flex-1 truncate text-left"
                        title={s.title}
                      >
                        💬 {s.title}
                      </button>
                      <button
                        onClick={() => {
                          setRenamingId(s.id);
                          setRenameValue(s.title);
                        }}
                        className="shrink-0 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                        aria-label="Rename chat"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeSession(s.id)}
                        className="shrink-0 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                        aria-label="Delete chat"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------- Account ---------- */}
        <div className="space-y-1 border-t border-border p-3 text-sm">
          <button
            onClick={logout}
            className="w-full rounded-md px-3 py-2 text-left text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            Sign out
          </button>
          <button
            onClick={handleDeleteAccount}
            className="w-full rounded-md px-3 py-2 text-left text-red-500 transition hover:bg-red-500/10"
          >
            Delete account
          </button>
        </div>
      </aside>
    </>
  );
}
