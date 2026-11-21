import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, X, RefreshCw, ArrowUpRight, Bot } from 'lucide-react';
import { supabase, askWorkspaceCopilot } from '../lib/supabase';
import { useWorkspaceId } from '../hooks/useWorkspaceQueries';
import type { Page } from '../lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: string;
  streaming?: boolean;
  action?: { label: string; page: Page };
}

const QUICK_PROMPTS = [
  'Who carried writing vs. verbal discussions?',
  'Generate 3-bullet grading justification per member',
  'Who showed fatigue, drowsiness, or distraction?',
  'Recommend task rebalancing for the next sprint',
];

export default function AiCopilotDrawer({
  open,
  onClose,
  navigate,
}: {
  open: boolean;
  onClose: () => void;
  navigate: (page: Page) => void;
}) {
  const workspaceId = useWorkspaceId();
  const [input, setInput] = useState('');
  const [loadingContext, setLoadingContext] = useState(false);
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState({ members: 0, iot: 0, docs: 0 });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      provider: 'Workspace Copilot',
      text: 'Ask me anything about member scores, transcripts, documents, fatigue alerts, or grading fairness across the active workspace.',
    },
  ]);

  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, []);

  const refreshCounts = useCallback(async () => {
    setLoadingContext(true);
    const [mRes, iRes, dRes] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('iot_data').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ]);
    setCounts({
      members: mRes.count ?? 0,
      iot: iRes.count ?? 0,
      docs: dRes.count ?? 0,
    });
    setLoadingContext(false);
  }, [workspaceId]);

  useEffect(() => {
    if (open) void refreshCounts();
  }, [open, refreshCounts]);

  const streamReplyText = (
    msgId: string,
    fullText: string,
    provider: string,
    action?: { label: string; page: Page },
  ) => {
    if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    const tokens = fullText.split(/(\s+)/);
    let idx = 0;

    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', text: '', provider, streaming: true, action },
    ]);

    streamTimerRef.current = setInterval(() => {
      idx = Math.min(tokens.length, idx + 4);
      const partial = tokens.slice(0, idx).join('');
      const done = idx >= tokens.length;
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: partial, streaming: !done } : m)),
      );
      if (done && streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    }, 18);
  };

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput('');
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await askWorkspaceCopilot(trimmed, workspaceId);
      streamReplyText(`a-${Date.now()}`, reply.answer, reply.provider, reply.action);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-white/15 bg-[#060C1A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-500/25">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ask ContribuTrack AI</h3>
              <p className="text-[10px] text-cyan-400 tabular-nums">
                Grounded on {counts.members} members · {counts.iot} readings · {counts.docs} docs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void refreshCounts()}
              title="Refresh live context"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={14} className={loadingContext ? 'animate-spin text-cyan-300' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-4 py-3">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => void submit(qp)}
              className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20"
            >
              {qp}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl p-3.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'ml-8 border border-indigo-500/30 bg-indigo-500/15 text-white'
                  : 'mr-4 border border-white/10 bg-white/[0.04] text-gray-200'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[10px] font-bold text-cyan-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Bot size={12} /> COPILOT
                  </span>
                  {m.provider && (
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-gray-300">
                      {m.provider}
                    </span>
                  )}
                </div>
              )}
              <p className="whitespace-pre-line">
                {m.text}
                {m.streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-cyan-400 align-middle" />}
              </p>
              {m.action && !m.streaming && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(m.action!.page);
                    onClose();
                  }}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/25"
                >
                  {m.action.label} <ArrowUpRight size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="border-t border-white/10 p-4"
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about grading, fatigue, writing, or a member…"
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
