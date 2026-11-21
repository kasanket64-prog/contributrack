import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, FileSpreadsheet, Loader, QrCode, RefreshCw, Upload, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { deriveLabel, MEMBER_COLORS } from '../../lib/dashboardMetrics';
import type { RouteParams } from '../../lib/router';
import type { Member, Page, WorkspaceInvite } from '../../lib/types';

function hashBit(seed: string, r: number, c: number): boolean {
  let h = 2166136261;
  const s = `${seed}:${r}:${c}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h & 1) === 1;
}

function DeterministicQrBadge({ value }: { value: string }) {
  const size = 21;
  const isFinder = (r: number, c: number) => {
    const corners = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ];
    for (const [cr, cc] of corners) {
      if (r >= cr && r < cr + 7 && c >= cc && c < cc + 7) {
        const dr = r - cr;
        const dc = c - cc;
        const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        return border || center;
      }
    }
    return null;
  };

  return (
    <svg
      viewBox={`0 0 ${size + 2} ${size + 2}`}
      className="h-28 w-28 rounded-xl bg-white p-1.5 shadow-lg flex-shrink-0"
      role="img"
      aria-label={`Invite QR badge for ${value}`}
    >
      <rect width={size + 2} height={size + 2} fill="#FFFFFF" />
      {Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
          const finder = isFinder(r, c);
          const on = finder !== null ? finder : hashBit(value, r, c);
          return on ? (
            <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width={1} height={1} fill="#0F172A" />
          ) : null;
        }),
      )}
    </svg>
  );
}

interface ParsedCsvRow {
  name: string;
  email: string;
  role: string;
  device_id: string;
  status: 'valid' | 'duplicate' | 'invalid';
  reason?: string;
}

const SAMPLE_CSV = `Karan Nair, karan.nair@example.com, member, device_5
Neha Gupta, neha.gupta@example.com, facilitator, device_6`;

export default function InviteAndImportModal({
  open,
  initialTab = 'invite',
  onClose,
  workspaceId,
  workspaceName,
  members,
  navigate,
}: {
  open: boolean;
  initialTab?: 'invite' | 'csv';
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  members: Member[];
  navigate?: (page: Page, params?: RouteParams) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'invite' | 'csv'>(initialTab);
  const [copiedCode, setCopiedCode] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importErr, setImportErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setCopiedCode(false);
      setImportMsg('');
      setImportErr('');
    }
  }, [open, initialTab]);

  const { data: invites = [], refetch } = useQuery({
    queryKey: ['workspace-invites', workspaceId],
    enabled: open,
    queryFn: async ({ signal }) => {
      const { data } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .abortSignal(signal);
      return (data ?? []) as WorkspaceInvite[];
    },
  });

  const existingEmails = useMemo(
    () => new Set(members.map((m) => m.email.toLowerCase())),
    [members],
  );

  const parsedRows = useMemo<ParsedCsvRow[]>(() => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    const seenInBatch = new Set<string>();
    const out: ParsedCsvRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (i === 0 && cols[0]?.toLowerCase() === 'name' && cols[1]?.toLowerCase().includes('email')) {
        continue;
      }
      const [rawName = '', rawEmail = '', rawRole = 'member', rawDev = ''] = cols;
      const email = rawEmail.toLowerCase();
      const role = ['member', 'leader', 'facilitator', 'observer'].includes(rawRole.toLowerCase())
        ? rawRole.toLowerCase()
        : 'member';

      if (!rawName || !email.includes('@')) {
        out.push({ name: rawName || 'Unknown', email: rawEmail, role, device_id: rawDev, status: 'invalid', reason: 'Missing valid name/email' });
        continue;
      }
      if (existingEmails.has(email) || seenInBatch.has(email)) {
        out.push({ name: rawName, email, role, device_id: rawDev, status: 'duplicate', reason: 'Already in workspace' });
        continue;
      }
      seenInBatch.add(email);
      out.push({ name: rawName, email, role, device_id: rawDev, status: 'valid' });
    }
    return out;
  }, [csvText, existingEmails]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.status === 'valid'), [parsedRows]);

  if (!open) return null;

  const primaryInvite = invites.find((i) => !i.session_id) ?? invites[0] ?? null;
  const activeCode = primaryInvite?.code ?? 'CAPSTONE-A';
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${activeCode}`
      : `https://contributrack.app/join/${activeCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      /* ignore clipboard refusal */
    }
  };

  const handleGenerateCode = async () => {
    setCreatingCode(true);
    try {
      const code = `CT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await supabase.from('workspace_invites').insert({
        workspace_id: workspaceId,
        code,
        role: 'member',
        created_by: 'instructor',
      });
      await refetch();
    } finally {
      setCreatingCode(false);
    }
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    e.target.value = '';
  };

  const handleImportBatch = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportErr('');
    setImportMsg('');
    try {
      const payload = validRows.map((row, idx) => ({
        workspace_id: workspaceId,
        name: row.name,
        email: row.email,
        role: row.role,
        device_id: row.device_id || null,
        avatar_color: MEMBER_COLORS[(members.length + idx) % MEMBER_COLORS.length],
        voice_label: deriveLabel(row.name),
        face_label: deriveLabel(row.name),
      }));
      const { error } = await supabase.from('members').insert(payload);
      if (error) throw error;

      setImportMsg(`Imported ${payload.length} member${payload.length === 1 ? '' : 's'} into ${workspaceName}.`);
      setCsvText('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['members', workspaceId] }),
        qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
        qc.invalidateQueries({ queryKey: ['workspace-meta', workspaceId] }),
      ]);
    } catch (err: unknown) {
      setImportErr(err instanceof Error ? err.message : 'Batch CSV import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/25 bg-[#070E1F] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-base font-black text-white">Team Invites &amp; Bulk CSV Import</h3>
            <p className="text-xs text-gray-400">
              Let students/teammates self-join <strong className="text-gray-200">{workspaceName}</strong> or import a whole cohort roster in one click.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close invite modal">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-white/10 px-6 py-2.5 flex gap-2 bg-white/[0.015]">
          <button
            type="button"
            onClick={() => setTab('invite')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              tab === 'invite'
                ? 'border border-cyan-500/35 bg-cyan-500/15 text-cyan-200'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <QrCode size={13} /> Invite Link &amp; QR
          </button>
          <button
            type="button"
            onClick={() => setTab('csv')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              tab === 'csv'
                ? 'border border-indigo-500/35 bg-indigo-500/15 text-indigo-200'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={13} /> Bulk CSV Import
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6 space-y-5">
          {tab === 'invite' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-5">
                <DeterministicQrBadge value={joinUrl} />
                <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                      Workspace Join Code
                    </p>
                    <p className="font-mono text-2xl font-black tracking-wider text-white mt-0.5 select-all">
                      {activeCode}
                    </p>
                  </div>
                  <p className="truncate rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-gray-200 select-all">
                    {joinUrl}
                  </p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-xs font-bold text-white"
                    >
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                      {copiedCode ? 'Copied Join Link' : 'Copy Invite Link'}
                    </button>
                    {navigate && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate('join', { inviteCode: activeCode });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
                      >
                        Preview Join Page <ExternalLink size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={creatingCode}
                      onClick={() => void handleGenerateCode()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      {creatingCode ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Generate New Code
                    </button>
                  </div>
                </div>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Active Workspace Invite Codes ({invites.length})
                  </p>
                  <div className="space-y-1.5">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-cyan-300">{inv.code}</span>
                          <span className="text-[10px] text-gray-400">role: {inv.role}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {inv.session_id ? 'Session-specific' : 'Full workspace'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-300">
                  Paste CSV rows as <code className="text-cyan-300">Name, Email, Role, Device ID</code> or upload a `.csv` file.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvText(SAMPLE_CSV)}
                    className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Load Sample Roster
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-200 hover:bg-white/10"
                  >
                    <Upload size={11} /> Upload CSV
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={(e) => void handleCsvFile(e)} className="hidden" />
                </div>
              </div>

              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={'Name, Email, Role, Device ID\nKaran Nair, karan.nair@example.com, member, device_5'}
                className="w-full rounded-2xl border border-white/15 bg-[#0B1222] p-3 font-mono text-xs text-gray-200 placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
              />

              {importMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {importMsg}
                </div>
              )}
              {importErr && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {importErr}
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.03] border-b border-white/10">
                      <tr>
                        {['Name', 'Email', 'Role', 'Device ID', 'Status'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2 font-semibold text-white">{row.name}</td>
                          <td className="px-3 py-2 text-gray-300">{row.email}</td>
                          <td className="px-3 py-2 text-gray-300">{row.role}</td>
                          <td className="px-3 py-2 font-mono text-gray-400">{row.device_id || '—'}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                row.status === 'valid'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  : row.status === 'duplicate'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                              }`}
                            >
                              {row.status === 'valid' ? 'Ready' : row.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={validRows.length === 0 || importing}
                  onClick={() => void handleImportBatch()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {importing ? <Loader size={12} className="animate-spin" /> : <Users size={12} />}
                  Import {validRows.length} Valid Member{validRows.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
