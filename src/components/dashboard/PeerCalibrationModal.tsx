import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star, X, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { MemberStat, PeerRatingEntry } from '../../lib/dashboardMetrics';

export default function PeerCalibrationModal({
  open,
  onClose,
  workspaceId,
  memberStats,
  initialRatings,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  memberStats: MemberStat[];
  initialRatings: Record<string, PeerRatingEntry>;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, PeerRatingEntry>>(initialRatings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initialRatings);
  }, [open, initialRatings]);

  if (!open) return null;

  const updateMember = (memberId: string, patch: Partial<PeerRatingEntry>) => {
    setDraft((prev) => ({
      ...prev,
      [memberId]: { rating: prev[memberId]?.rating ?? 0, note: prev[memberId]?.note ?? '', ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(draft).filter(([, v]) => v.rating >= 1 && v.rating <= 5);
      if (entries.length > 0) {
        await supabase.from('peer_reviews').upsert(
          entries.map(([member_id, v]) => ({
            workspace_id: workspaceId,
            member_id,
            rating: v.rating,
            note: v.note ?? '',
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'workspace_id,member_id' },
        );
      }
      await qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#070E1F] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Star size={15} className="text-amber-400 fill-amber-400" />
              360° Peer Check-In &amp; Offline Calibration
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Credit offline contributions (whiteboarding, debugging, architecture) — synced per workspace
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-6">
          {memberStats.map((ms) => {
            const entry = draft[ms.member.id] ?? { rating: 0, note: '' };
            return (
              <div key={ms.member.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">{ms.member.name}</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">Telemetry Score: {ms.overallScore}/100</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        aria-label={`Rate ${ms.member.name} ${starVal} stars`}
                        onClick={() => updateMember(ms.member.id, { rating: starVal })}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          size={16}
                          className={
                            starVal <= entry.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-gray-600 hover:text-gray-400'
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={entry.note}
                  onChange={(e) => updateMember(ms.member.id, { note: e.target.value })}
                  placeholder="Optional offline contribution note (e.g. helped debug pipeline, sketched architecture)"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {saving && <Loader size={12} className="animate-spin" />}
            Save Check-In
          </button>
        </div>
      </div>
    </div>
  );
}
