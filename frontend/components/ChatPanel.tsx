"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import { ApiError, ChatMessageItem, streamChat } from "@/lib/api";

interface Props {
  activeSessionId: number | null;
  messages: ChatMessageItem[];
  setMessages: Dispatch<SetStateAction<ChatMessageItem[]>>;
  onSessionCreated: (id: number) => void;
  onToggleSidebar: () => void;
}

export default function ChatPanel({
  activeSessionId,
  messages,
  setMessages,
  onSessionCreated,
  onToggleSidebar,
}: Props) {
  const { token } = useAuth();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const query = input.trim();
    if (!query || streaming || !token) return;

    setInput("");
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";

    const writeAssistant = (text: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: text };
        return next;
      });

    try {
      const outcome = await streamChat(
        token,
        { query, session_id: activeSessionId },
        {
          signal: controller.signal,
          onToken: (chunk) => {
            acc += chunk;
            writeAssistant(acc);
          },
        },
      );
      if (!acc) writeAssistant(outcome.text || "*(no response)*");
      if (!activeSessionId && outcome.sessionId) {
        onSessionCreated(outcome.sessionId);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        writeAssistant(acc ? `${acc}\n\n_(stopped)_` : "_(stopped)_");
      } else {
        const msg =
          err instanceof ApiError
            ? `⚠️ ${err.message}`
            : "⚠️ Could not reach the API.";
        writeAssistant(acc ? `${acc}\n\n${msg}` : msg);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted md:hidden"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <h1 className="truncate text-sm font-medium">
          {activeSessionId ? "Conversation" : "New chat"}
        </h1>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
          {messages.length === 0 && (
            <div className="mt-20 text-center text-muted-foreground">
              <p className="text-lg font-medium text-foreground">
                Ask anything about your documents
              </p>
              <p className="mt-1 text-sm">
                Upload files in the sidebar, then start a conversation.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <Message
              key={i}
              role={m.role}
              content={m.content}
              pending={
                streaming &&
                i === messages.length - 1 &&
                m.role === "assistant" &&
                m.content === ""
              }
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-surface px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Message DocuMind…"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-muted"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
          Answers are generated from your uploaded documents and may be
          incomplete.
        </p>
      </div>
    </>
  );
}

function Message({
  role,
  content,
  pending,
}: {
  role: "user" | "assistant";
  content: string;
  pending: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-surface-muted text-foreground"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap bg-primary text-primary-foreground"
            : "border border-border bg-surface"
        }`}
      >
        {isUser ? (
          content
        ) : (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {pending && (
          <span className="animate-blink ml-0.5 inline-block">▋</span>
        )}
      </div>
    </div>
  );
}
