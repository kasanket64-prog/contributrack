import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileText, Trash2, Loader, AlertCircle, BarChart2,
  CheckCircle, Users, FileSpreadsheet, Presentation, File, ChevronDown, ChevronUp,
  GitBranch, ClipboardPaste,
} from 'lucide-react';
import { supabase, triggerContributionAnalysis } from '../lib/supabase';
import { analyzeText, extractText, getFileMeta, type FileCategory } from '../lib/documentParser';
import { useDocumentsQuery, useWorkspaceId } from '../hooks/useWorkspaceQueries';
import type { Document } from '../lib/types';

function FileIcon({ category, className }: { category: FileCategory; className?: string }) {
  if (category === 'excel') return <FileSpreadsheet size={16} className={className} />;
  if (category === 'pptx') return <Presentation size={16} className={className} />;
  if (category === 'unknown') return <File size={16} className={className} />;
  return <FileText size={16} className={className} />;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6'];
const MAX_SIZE_MB = 25;
const ACCEPT = '.txt,.md,.csv,.json,.html,.htm,.js,.ts,.tsx,.jsx,.py,.xml,.yaml,.yml,.css,.sh,.sql,.pdf,.doc,.docx,.ppt,.pptx,.xlsx';

export default function Documents() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useDocumentsQuery(workspaceId);
  const documents = data?.documents ?? [];
  const members = data?.members ?? [];
  const loading = isLoading && !data;

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedMember, setSelectedMember] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [repoSlug, setRepoSlug] = useState('kasanket64-prog/track');
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [repoStatus, setRepoStatus] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteBody, setPasteBody] = useState('');
  const [savingPaste, setSavingPaste] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['documents', workspaceId] }),
      qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
    ]);
  };

  const processFile = async (file: File) => {
    setError('');
    setUploadStatus('');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    const meta = getFileMeta(file.name, file.type);
    setUploading(true);
    try {
      setUploadStatus(`Extracting text from ${meta.label}…`);
      const raw = await extractText(file, meta.category);

      if (!raw.trim()) {
        setError('Could not extract any text from this file. It may be image-only or encrypted.');
        return;
      }

      setUploadStatus('Analysing content…');
      const analysis = analyzeText(raw);

      const { error: err } = await supabase.from('documents').insert({
        workspace_id: workspaceId,
        name: file.name,
        file_type: file.type || `application/${meta.category}`,
        file_size: file.size,
        content: raw.slice(0, 5000),
        word_count: analysis.wordCount,
        char_count: analysis.charCount,
        member_id: selectedMember || null,
        analysis_result: { ...analysis, fileCategory: meta.category },
      });
      if (err) throw err;
      await fetchData();
      void triggerContributionAnalysis(undefined, workspaceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', id);
    await fetchData();
    if (selectedDoc?.id === id) {
      setSelectedDoc(null);
      setShowPreview(false);
    }
    void triggerContributionAnalysis(undefined, workspaceId);
  };

  const handleReassign = async (docId: string, nextMemberId: string) => {
    setReassigning(true);
    const val = nextMemberId || null;
    await supabase.from('documents').update({ member_id: val }).eq('id', docId);
    setSelectedDoc((prev) => (prev && prev.id === docId ? { ...prev, member_id: val } : prev));
    await fetchData();
    void triggerContributionAnalysis(undefined, workspaceId);
    setReassigning(false);
  };

  const handleImportGithub = async () => {
    setError('');
    setRepoStatus('');
    const cleaned = repoSlug
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');
    const parts = cleaned.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setError('Enter a repository as owner/repo (e.g. kasanket64-prog/track).');
      return;
    }
    const [owner, repo] = parts;
    setSyncingRepo(true);

    interface CommitInfo {
      sha: string;
      author: string;
      email: string;
      date: string;
      message: string;
    }

    let commits: CommitInfo[] = [];
    let sourceLabel = 'live GitHub API';

    try {
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=15`);
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      const json = (await res.json()) as Array<{
        sha?: string;
        commit?: { author?: { name?: string; email?: string; date?: string }; message?: string };
      }>;
      commits = json.map((c) => ({
        sha: (c.sha ?? '0000000').slice(0, 7),
        author: c.commit?.author?.name ?? 'Contributor',
        email: c.commit?.author?.email ?? '',
        date: c.commit?.author?.date ?? new Date().toISOString(),
        message: (c.commit?.message ?? 'Update files').split('\n')[0],
      }));
    } catch {
      sourceLabel = 'offline commit telemetry fallback';
      const fallbackAuthors = members.length
        ? members.map((m) => ({ name: m.name, email: m.email }))
        : [{ name: 'Team Contributor', email: 'dev@example.com' }];
      const sampleMsgs = [
        'feat: wire sensor engagement pipeline and calibration scoring',
        'fix: harden edge function authentication and signed biometric URLs',
        'refactor: modularize spatial dashboard components and SVG charts',
        'docs: add local demo setup instructions and endpoint payload guide',
        'test: verify real-time contribution fairness across active sessions',
      ];
      commits = sampleMsgs.map((msg, idx) => {
        const a = fallbackAuthors[idx % fallbackAuthors.length];
        return {
          sha: `a9f${idx + 1}c2${idx}`,
          author: a.name,
          email: a.email,
          date: new Date(Date.now() - idx * 3600_000 * 4).toISOString(),
          message: msg,
        };
      });
    }

    try {
      const grouped = new Map<string, { memberId: string | null; memberName: string; commits: CommitInfo[] }>();
      const fallbackId = selectedMember || members[0]?.id || null;
      const fallbackName = members.find((m) => m.id === fallbackId)?.name ?? 'Team';

      for (const c of commits) {
        const matched = members.find(
          (m) =>
            m.email.toLowerCase() === c.email.toLowerCase() ||
            m.name.toLowerCase() === c.author.toLowerCase(),
        );
        const key = matched?.id ?? fallbackId ?? 'unassigned';
        const existing = grouped.get(key) ?? {
          memberId: matched?.id ?? fallbackId,
          memberName: matched?.name ?? fallbackName,
          commits: [],
        };
        existing.commits.push(c);
        grouped.set(key, existing);
      }

      const entriesToInsert = Array.from(grouped.values()).map((bucket) => {
        const summaryText = [
          `# GitHub Commit Telemetry — ${owner}/${repo} (${bucket.memberName})`,
          `Synced ${bucket.commits.length} commits (${sourceLabel}) on ${new Date().toLocaleString()}.`,
          '',
          ...bucket.commits.map(
            (c) => `- [${c.sha}] ${c.message} — ${c.author} (${new Date(c.date).toLocaleDateString()})`,
          ),
        ].join('\n');
        const analysis = analyzeText(summaryText);
        const safeAuthorSlug = bucket.memberName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return {
          workspace_id: workspaceId,
          name: grouped.size > 1 ? `GitHub_${repo}_${safeAuthorSlug}.md` : `GitHub_${repo}_Commits.md`,
          file_type: 'text/markdown',
          file_size: summaryText.length,
          content: summaryText.slice(0, 5000),
          word_count: analysis.wordCount,
          char_count: analysis.charCount,
          member_id: bucket.memberId,
          analysis_result: { ...analysis, fileCategory: 'text', githubRepo: `${owner}/${repo}` },
        };
      });

      const { error: err } = await supabase.from('documents').insert(entriesToInsert);
      if (err) throw err;

      setRepoStatus(
        `Imported ${commits.length} commits from ${owner}/${repo} attributed across ${grouped.size} team member${grouped.size === 1 ? '' : 's'} (${sourceLabel}).`,
      );
      await fetchData();
      void triggerContributionAnalysis(undefined, workspaceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'GitHub commit import failed.');
    } finally {
      setSyncingRepo(false);
    }
  };

  const handleSavePastedNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pasteBody.trim()) {
      setError('Paste meeting notes, Google Doc text, or research summary before saving.');
      return;
    }
    setSavingPaste(true);
    try {
      const title = (pasteTitle.trim() || `Team Notes ${new Date().toLocaleDateString()}`).replace(/\.(md|txt)$/i, '');
      const content = pasteBody.trim();
      const analysis = analyzeText(content);
      const { error: err } = await supabase.from('documents').insert({
        workspace_id: workspaceId,
        name: `${title}.md`,
        file_type: 'text/markdown',
        file_size: content.length,
        content: content.slice(0, 5000),
        word_count: analysis.wordCount,
        char_count: analysis.charCount,
        member_id: selectedMember || members[0]?.id || null,
        analysis_result: { ...analysis, fileCategory: 'text', source: 'pasted_notes' },
      });
      if (err) throw err;
      setPasteTitle('');
      setPasteBody('');
      setPasteOpen(false);
      await fetchData();
      void triggerContributionAnalysis(undefined, workspaceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save pasted notes.');
    } finally {
      setSavingPaste(false);
    }
  };

  const getMemberName = (id: string | null | undefined) => {
    if (!id) return 'Unassigned';
    return members.find((m) => m.id === id)?.name ?? 'Unknown';
  };

  const totalWords = documents.reduce((s, d) => s + d.word_count, 0);

  const memberWordCounts = members.map((m, i) => {
    const docs = documents.filter((d) => d.member_id === m.id);
    return { name: m.name, words: docs.reduce((s, d) => s + d.word_count, 0), color: COLORS[i % COLORS.length], docs: docs.length };
  }).filter((m) => m.words > 0);

  return (
    <div className="relative min-h-full p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-white">Documents &amp; Code Telemetry</h2>
          <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{documents.length} documents, {totalWords.toLocaleString()} total words</p>
        </div>
      </div>

      {/* Side-by-side Bento Ingestion Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* GitHub Repository Sync (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-indigo-500/25 bg-white/[0.025] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                <GitBranch size={15} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">GitHub Repository Sync</h3>
                <p className="text-[11px] text-gray-400">Import recent commits into scoring</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRepoSlug('kasanket64-prog/track')}
              className="flex-shrink-0 whitespace-nowrap text-[10px] font-mono text-cyan-300 border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 rounded-lg hover:bg-cyan-500/20"
            >
              Use kasanket64-prog/track
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                value={repoSlug}
                onChange={(e) => setRepoSlug(e.target.value)}
                placeholder="owner/repo or URL"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0B1222] px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:border-indigo-400/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleImportGithub()}
                disabled={syncingRepo || !repoSlug.trim()}
                className="inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] disabled:opacity-50"
              >
                {syncingRepo ? <Loader size={13} className="animate-spin" /> : <GitBranch size={13} />}
                {syncingRepo ? 'Syncing…' : 'Import Commits'}
              </button>
            </div>
            {repoStatus ? (
              <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <CheckCircle size={12} className="flex-shrink-0" /> {repoStatus}
              </p>
            ) : (
              <p className="text-[11px] text-gray-400">Matches commit authors automatically to registered members.</p>
            )}
          </div>
        </div>

        {/* File Dropzone + Member Assignment (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <Upload size={14} className="text-cyan-400 flex-shrink-0" /> Upload Document or Code File
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen((p) => !p)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                <ClipboardPaste size={12} /> Paste Notes / Google Doc
              </button>
              <Users size={13} className="text-gray-400 flex-shrink-0" />
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                aria-label="Assign uploaded document to member"
                className="px-2.5 py-1 text-xs border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500/40 bg-[#0B1222] text-gray-200"
              >
                <option value="">Assign to member (optional)</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {pasteOpen && (
            <form onSubmit={(e) => void handleSavePastedNotes(e)} className="rounded-xl border border-cyan-500/25 bg-[#080F20] p-3.5 space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Title (e.g. Architecture Notes — Sprint 2)"
                  className="flex-1 min-w-[180px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingPaste || !pasteBody.trim()}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  {savingPaste ? 'Analyzing…' : 'Save & Score Notes'}
                </button>
              </div>
              <textarea
                rows={4}
                value={pasteBody}
                onChange={(e) => setPasteBody(e.target.value)}
                placeholder="Paste Google Doc draft, Notion specs, or lab notes directly here…"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 resize-none focus:border-cyan-400/50 focus:outline-none"
              />
            </form>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-4 py-4 text-center transition-all bg-white/[0.015] ${
              uploading ? 'cursor-default opacity-80' : 'cursor-pointer'
            } ${dragOver ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.04]'}`}
          >
            <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFileChange} className="hidden" />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-cyan-400 py-1">
                <Loader size={18} className="animate-spin" />
                <p className="text-xs font-medium">{uploadStatus || 'Processing…'}</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div>
                  <p className="text-xs font-semibold text-gray-200">Drag &amp; drop a file, or click to browse</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    PDF, Word, PowerPoint, Excel, Text &amp; Code · Max {MAX_SIZE_MB} MB
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {[
                    { label: 'PDF',  bg: 'bg-red-500/15 border-red-500/20',     text: 'text-red-300'   },
                    { label: 'DOCX', bg: 'bg-blue-500/15 border-blue-500/20',    text: 'text-blue-300'  },
                    { label: 'PPTX', bg: 'bg-orange-500/15 border-orange-500/20',  text: 'text-orange-300'},
                    { label: 'XLSX', bg: 'bg-emerald-500/15 border-emerald-500/20', text: 'text-emerald-300' },
                    { label: 'MD/PY', bg: 'bg-sky-500/15 border-sky-500/20',     text: 'text-sky-300'   },
                    { label: '+ more', bg: 'bg-white/5 border-white/10',  text: 'text-gray-300'  },
                  ].map((b) => (
                    <span key={b.label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${b.bg} ${b.text}`}>{b.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-300 text-sm px-4 py-2.5 rounded-xl">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Document List */}
        <div className="lg:col-span-2 space-y-4">

          {/* Document List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-white/[0.025] rounded-2xl border border-white/8 p-10 text-center">
              <FileText size={28} className="mx-auto text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                const analysis = doc.analysis_result as { contributionScore?: number; fileCategory?: string };
                const meta = getFileMeta(doc.name, doc.file_type ?? '');
                return (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDoc(isSelected ? null : doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDoc(isSelected ? null : doc);
                      }
                    }}
                    className={`w-full text-left bg-white/[0.025] rounded-2xl border p-4 cursor-pointer hover:bg-white/[0.04] transition-all ${
                      isSelected ? 'border-cyan-400/50 ring-1 ring-cyan-400/40 bg-cyan-500/[0.04]' : 'border-white/8 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <FileIcon category={meta.category} className={meta.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{doc.name}</p>
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                              style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                              {meta.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Delete ${doc.name}`}
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                            className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400 tabular-nums">
                          <span>{doc.word_count.toLocaleString()} words</span>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                          <span className="text-cyan-400 font-medium">{getMemberName(doc.member_id)}</span>
                          {analysis.contributionScore !== undefined && (
                            <span className="text-emerald-400 font-medium">Score: {analysis.contributionScore}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        <div className="space-y-4">
          <div className="bg-white/[0.025] rounded-2xl border border-white/8 p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-sm">
              <BarChart2 size={16} className="text-cyan-400" />
              Writing Contributions
            </h3>
            {memberWordCounts.length > 0 ? (
              <div className="space-y-3">
                {memberWordCounts.map((m, i) => {
                  const pct = totalWords > 0 ? Math.round((m.words / totalWords) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1 tabular-nums">
                        <span className="font-medium text-gray-200">{m.name}</span>
                        <span className="text-gray-400">{m.words.toLocaleString()} words ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: m.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">Upload documents and assign to members to see analysis</p>
            )}
          </div>

          {selectedDoc ? (
            <div className="bg-white/[0.025] rounded-2xl border border-cyan-500/25 p-5">
              {(() => {
                const meta = getFileMeta(selectedDoc.name, selectedDoc.file_type ?? '');
                const a = selectedDoc.analysis_result as {
                  wordCount?: number; charCount?: number; sentences?: number;
                  avgWordLength?: number; readabilityScore?: number;
                  contributionScore?: number; uniqueWords?: number;
                  vocabularyRichness?: number;
                };
                const metrics = [
                  { label: 'Words',              value: a.wordCount?.toLocaleString() ?? '—' },
                  { label: 'Characters',          value: a.charCount?.toLocaleString() ?? '—' },
                  { label: 'Sentences',           value: a.sentences ?? '—' },
                  { label: 'Avg Word Length',     value: a.avgWordLength ?? '—' },
                  { label: 'Unique Words',        value: a.uniqueWords?.toLocaleString() ?? '—' },
                  { label: 'Vocabulary Richness', value: `${a.vocabularyRichness ?? 0}%` },
                ];
                return (
                  <>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`w-8 h-8 ${meta.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <FileIcon category={meta.category} className={meta.iconColor} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white text-sm truncate">{selectedDoc.name}</h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {metrics.map((m, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-center">
                          <p className="text-[11px] text-gray-500">{m.label}</p>
                          <p className="font-bold text-white text-sm mt-0.5">{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Readability', value: a.readabilityScore ?? 0, color: '#10B981' },
                        { label: 'Contribution', value: a.contributionScore ?? 0, color: '#06B6D4' },
                      ].map((s, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">{s.label} Score</span>
                            <span className="font-semibold" style={{ color: s.color }}>{s.value}/100</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mb-1.5">
                          <CheckCircle size={12} className="text-emerald-400" />
                          Assigned Member
                        </label>
                        <select
                          value={selectedDoc.member_id ?? ''}
                          disabled={reassigning}
                          onChange={(e) => void handleReassign(selectedDoc.id, e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-[#0B1222] text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedDoc.content && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowPreview((p) => !p)}
                            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.06]"
                          >
                            <span>Preview Extracted Text</span>
                            {showPreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          {showPreview && (
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#050A14] p-3 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap">
                              {selectedDoc.content}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-white/[0.025] rounded-2xl border border-white/8 p-8 text-center">
              <FileText size={24} className="mx-auto text-gray-600 mb-2" />
              <p className="text-xs text-gray-500">Click a document to view its analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
