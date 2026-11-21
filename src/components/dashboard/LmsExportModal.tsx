import { useMemo, useState } from 'react';
import { Download, GraduationCap, X } from 'lucide-react';
import { buildLmsCsv, computeRubricGrades, type LmsPlatform } from '../../lib/lmsExport';
import type { MemberStat, PeerRatingEntry } from '../../lib/dashboardMetrics';
import type { ContributionEvidence } from '../../lib/types';

export default function LmsExportModal({
  open,
  onClose,
  workspaceName,
  memberStats,
  peerRatings,
  evidence,
}: {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  memberStats: MemberStat[];
  peerRatings: Record<string, PeerRatingEntry>;
  evidence: ContributionEvidence[];
}) {
  const [platform, setPlatform] = useState<LmsPlatform>('canvas');
  const [telemetryWeight, setTelemetryWeight] = useState(70);
  const [peerWeight, setPeerWeight] = useState(30);
  const [evidenceBonusMax, setEvidenceBonusMax] = useState(15);
  const [maxPoints, setMaxPoints] = useState(100);

  const approvedByMember = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ev of evidence) {
      if (ev.status === 'approved') {
        map[ev.member_id] = (map[ev.member_id] ?? 0) + 1;
      }
    }
    return map;
  }, [evidence]);

  const gradedRows = useMemo(
    () =>
      computeRubricGrades(memberStats, peerRatings, approvedByMember, {
        telemetryWeight,
        peerWeight,
        evidenceBonusMax,
        maxPoints,
      }),
    [memberStats, peerRatings, approvedByMember, telemetryWeight, peerWeight, evidenceBonusMax, maxPoints],
  );

  if (!open) return null;

  const handleDownload = () => {
    const csv = buildLmsCsv(gradedRows, platform, workspaceName);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contributrack-${platform}-grades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-indigo-500/25 bg-[#070E1F] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">LMS Gradebook &amp; Rubric Export</h3>
              <p className="text-xs text-gray-400">
                Configure grading weights across telemetry, 360° peer credit, and approved offline evidence.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close LMS gradebook modal">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {/* Platform Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                { id: 'canvas', label: 'Canvas LMS', sub: 'SIS Login ID & Section CSV' },
                { id: 'moodle', label: 'Moodle Gradebook', sub: 'Email & Feedback comments' },
                { id: 'google_classroom', label: 'Google Classroom', sub: 'Max Points & Rationale' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  platform === p.id
                    ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                    : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20'
                }`}
              >
                <p className="text-xs font-bold">{p.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{p.sub}</p>
              </button>
            ))}
          </div>

          {/* Rubric Weight Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1">
                Telemetry Weight (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={telemetryWeight}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setTelemetryWeight(val);
                  setPeerWeight(100 - val);
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-1.5 text-xs font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1">
                Peer Calibration (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={peerWeight}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setPeerWeight(val);
                  setTelemetryWeight(100 - val);
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-1.5 text-xs font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1">
                Evidence Bonus Max
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={evidenceBonusMax}
                onChange={(e) => setEvidenceBonusMax(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-1.5 text-xs font-bold text-emerald-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1">
                Max Grade Points
              </label>
              <input
                type="number"
                min={10}
                max={1000}
                value={maxPoints}
                onChange={(e) => setMaxPoints(Math.max(10, Number(e.target.value) || 100))}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-1.5 text-xs font-bold text-cyan-300"
              />
            </div>
          </div>

          {/* Live Grade Preview */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/10">
                <tr>
                  {['Student', 'Telemetry', 'Peer', 'Evidence Bonus', 'Final Score', 'Grade'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradedRows.map((row) => (
                  <tr key={row.memberId} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-white">{row.name}</p>
                      <p className="text-[10px] text-gray-400">{row.email}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-300 tabular-nums">{row.rawScore}/100</td>
                    <td className="px-3 py-2.5 font-mono text-gray-300 tabular-nums">{row.peerScore}/100</td>
                    <td className="px-3 py-2.5 font-mono text-emerald-300 tabular-nums">+{row.evidenceBonus}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-cyan-300 tabular-nums">
                      {row.pointsEarned} / {row.maxPoints}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-indigo-200">
                        {row.letterGrade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={gradedRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Download size={13} /> Download LMS CSV
          </button>
        </div>
      </div>
    </div>
  );
}
