import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, ExternalLink, FilePlus2, HelpCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ContributionEvidence, Member } from '../../lib/types';

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

const STATUS_BADGE: Record<ContributionEvidence['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending Review', cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300' },
  approved: { label: 'Approved (+Credit)', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' },
  needs_info: { label: 'Needs Info', cls: 'border-rose-500/25 bg-rose-500/10 text-rose-300' },
};

export default function EvidenceReviewCard({
  workspaceId,
  evidence,
  members,
  onOpenSubmit,
}: {
  workspaceId: string;
  evidence: ContributionEvidence[];
  members: Member[];
  onOpenSubmit: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const pendingCount = evidence.filter((e) => e.status === 'pending').length;

  const getMemberName = (ev: ContributionEvidence) =>
    ev.members?.name ?? members.find((m) => m.id === ev.member_id)?.name ?? 'Member';

  const handleReview = async (item: ContributionEvidence, status: 'approved' | 'needs_info') => {
    setUpdatingId(item.id);
    try {
      const reviewerNote =
        notes[item.id]?.trim() ||
        item.reviewer_note ||
        (status === 'approved' ? 'Verified offline engineering contribution.' : 'Please attach artifact or commit link.');

      await supabase
        .from('contribution_evidence')
        .update({
          status,
          reviewer_note: reviewerNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      await qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#111114] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300">
            <ClipboardCheck size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Offline Evidence &amp; Score Appeals</h3>
              {pendingCount > 0 && (
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300 tabular-nums">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Approve offline hardware, design, or lab work so algorithmic scores stay fair.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSubmit}
          className="no-print inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
        >
          <FilePlus2 size={13} /> Submit Evidence
        </button>
      </div>

      {evidence.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
          No offline evidence or score appeals submitted in this workspace yet.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {evidence.map((ev) => {
            const badge = STATUS_BADGE[ev.status];
            const noteVal = notes[ev.id] ?? ev.reviewer_note ?? '';
            return (
              <div key={ev.id} className="py-4 first:pt-1 last:pb-1 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-white">{ev.title}</span>
                      <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
                        {ev.category}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Submitted by <strong className="text-zinc-200 font-medium">{getMemberName(ev)}</strong> ·{' '}
                      <span className="tabular-nums text-zinc-300 font-medium">{ev.hours}h offline effort</span>
                    </p>
                  </div>

                  {isSafeHttpUrl(ev.evidence_url) && (
                    <a
                      href={ev.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.08]"
                    >
                      Artifact <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {ev.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed">{ev.description}</p>
                )}

                <div className="no-print flex flex-wrap items-center gap-2 pt-1">
                  <input
                    value={noteVal}
                    onChange={(e) => setNotes((n) => ({ ...n, [ev.id]: e.target.value }))}
                    placeholder="Reviewer feedback or rubric adjustment note…"
                    className="min-w-[180px] flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-white/25 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={updatingId === ev.id}
                    onClick={() => void handleReview(ev, 'approved')}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
                  >
                    {updatingId === ev.id ? <Loader size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                    Approve (+Credit)
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === ev.id}
                    onClick={() => void handleReview(ev, 'needs_info')}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50 whitespace-nowrap"
                  >
                    <HelpCircle size={11} /> Request Info
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
