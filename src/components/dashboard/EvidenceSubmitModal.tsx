import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Loader, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ContributionEvidence, Member } from '../../lib/types';

const CATEGORIES: Array<{ id: ContributionEvidence['category']; label: string }> = [
  { id: 'hardware', label: 'Hardware / Soldering' },
  { id: 'design', label: 'UI / Figma / CAD' },
  { id: 'code', label: 'Offline Code / Debug' },
  { id: 'research', label: 'Research / Interviews' },
  { id: 'facilitation', label: 'Facilitation / Planning' },
];

export default function EvidenceSubmitModal({
  open,
  onClose,
  workspaceId,
  members,
  defaultMemberId,
  lockMember = false,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: Member[];
  defaultMemberId?: string;
  lockMember?: boolean;
}) {
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState(defaultMemberId || members[0]?.id || '');
  const [category, setCategory] = useState<ContributionEvidence['category']>('hardware');
  const [title, setTitle] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [hours, setHours] = useState('2.5');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMemberId(defaultMemberId || members[0]?.id || '');
      setError('');
    }
  }, [open, defaultMemberId, members]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const targetMemberId = memberId || members[0]?.id;
    if (!targetMemberId || !title.trim()) {
      setError('Select a member and describe what you built or contributed.');
      return;
    }

    setSaving(true);
    try {
      const parsedHours = Math.max(0.25, Math.min(200, Number(hours) || 1));
      const { error: err } = await supabase.from('contribution_evidence').insert({
        workspace_id: workspaceId,
        member_id: targetMemberId,
        category,
        title: title.trim(),
        evidence_url: evidenceUrl.trim(),
        hours: parsedHours,
        description: description.trim(),
        status: 'pending',
      });
      if (err) throw err;

      await qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
      setTitle('');
      setEvidenceUrl('');
      setDescription('');
      setHours('2.5');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit evidence.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-500/25 bg-[#070E1F] p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
              <FilePlus2 size={17} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Submit Offline Evidence / Score Appeal</h3>
              <p className="text-xs text-gray-400">
                Log hardware lab hours, Figma work, whiteboard design, or request score review.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close evidence modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Contributor</label>
              <select
                value={memberId}
                disabled={lockMember}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-xs text-gray-200 disabled:opacity-70"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Work Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContributionEvidence['category'])}
                className="w-full rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-xs text-gray-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Title / Deliverable *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Soldered ultrasonic array & drafted Figma user flows"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-300 mb-1">Artifact Link (Figma, GitHub, Drive)</label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Hours Spent</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="200"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Explanation / Appeal Context</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe offline effort not captured by webcam or shared documents…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 resize-none focus:border-cyan-400/50 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving && <Loader size={12} className="animate-spin" />}
              Submit for Instructor Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
