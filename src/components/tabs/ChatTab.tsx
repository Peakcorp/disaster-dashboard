"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  text: string;
}

const SUGGESTIONS = [
  "How many active wildfires are there right now?",
  "What's happening in Florida?",
  "Which categories have the most active events?",
  "What materials are most likely to be in shortage right now?",
];

export function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-query", { body: { question } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer as string }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err instanceof Error ? err.message : "Something went wrong asking the dashboard." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="glass-card rounded-lg p-3 text-xs text-foreground-muted">
        Ask about active events, categories, states, or materials. Answers backed by this dashboard&apos;s live
        data are labeled as such; anything else comes from general knowledge and is flagged too.
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-foreground-muted">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="glass-card w-fit rounded-md px-3 py-1.5 text-left text-sm text-live hover:brightness-125"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`glass-card max-w-2xl rounded-lg p-3 text-sm ${
              m.role === "user"
                ? "self-end border-live/40"
                : m.role === "error"
                  ? "self-start border-critical/40 text-critical"
                  : "self-start"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <p className="text-xs text-foreground-muted">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the dashboard…"
          className="glass-card min-w-0 flex-1 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="glass-card rounded-md px-4 py-2 text-sm text-live transition hover:brightness-125 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
