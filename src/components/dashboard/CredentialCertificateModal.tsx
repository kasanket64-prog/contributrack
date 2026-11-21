import { useEffect, useState } from 'react';
import { ShieldCheck, Copy, Check, Printer, Star, X, ExternalLink, Download, Award } from 'lucide-react';
import { signContributionCredential } from '../../lib/supabase';
import { buildCertificateSvg, buildLinkedInCertUrl, downloadCertificateSvg } from '../../lib/certificateExport';
import type { CalibrationBadge, MemberStat } from '../../lib/dashboardMetrics';
import type { FairnessMethod } from '../../lib/settings';
import type { Page } from '../../lib/types';

export default function CredentialCertificateModal({
  certMember,
  calibration,
  workspaceId,
  workspaceName,
  fairnessMethod,
  onClose,
  navigate,
}: {
  certMember: MemberStat | null;
  calibration: CalibrationBadge | null;
  workspaceId: string;
  workspaceName: string;
  fairnessMethod: FairnessMethod;
  onClose: () => void;
  navigate?: (page: Page, params?: { credentialId?: string }) => void;
}) {
  const [credentialId, setCredentialId] = useState('');
  const [signature, setSignature] = useState('');
  const [algorithm, setAlgorithm] = useState('HMAC-SHA256');
  const [issuedAt, setIssuedAt] = useState('');
  const [signing, setSigning] = useState(false);
  const [copied, setCopied] = useState(false);

  const canonicalPayload = certMember
    ? {
        protocol: 'ContribuTrack Proof-of-Contribution v2026.2',
        workspaceId,
        workspace: workspaceName,
        fairnessMethod,
        member: {
          id: certMember.member.id,
          name: certMember.member.name,
          role: certMember.member.role,
        },
        metrics: {
          overallScore: certMember.overallScore,
          contributionPct: certMember.contributionPct,
          engagementLevel: certMember.engagementLevel ?? 'UNSCORED',
          voiceScore: certMember.voiceScore,
          presenceScore: certMember.presenceScore,
          writingScore: certMember.writingScore,
          consistencyScore: certMember.consistencyScore,
          activeMinutes: certMember.activeMinutes,
          sessionMinutes: certMember.sessionMinutes,
          wordCount: certMember.wordCount,
          docCount: certMember.docCount,
          peerCalibration: calibration ? `${calibration.rating}/5 (${calibration.label})` : null,
        },
      }
    : null;

  const payloadKey = canonicalPayload ? JSON.stringify(canonicalPayload) : '';

  useEffect(() => {
    if (!certMember || !canonicalPayload) {
      setCredentialId('');
      setSignature('');
      return;
    }
    let cancelled = false;
    setSigning(true);
    setCopied(false);
    signContributionCredential({
      payload: canonicalPayload,
      workspaceId,
      workspaceName,
      memberId: certMember.member.id,
      memberName: certMember.member.name,
    })
      .then((res) => {
        if (cancelled) return;
        setCredentialId(res.credential_id);
        setSignature(res.signature);
        setAlgorithm(res.algorithm);
        setIssuedAt(res.issued_at);
      })
      .catch(() => {
        if (!cancelled) {
          setCredentialId('CT-2026-UNSIGNED');
        }
      })
      .finally(() => {
        if (!cancelled) setSigning(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, workspaceId]);

  if (!certMember) return null;

  const verificationJson = {
    credentialId: credentialId || 'CT-2026-PENDING',
    algorithm,
    signature,
    issuedAt: issuedAt || new Date().toISOString(),
    ...canonicalPayload,
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(verificationJson, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore clipboard refusal */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md print:static print:bg-white print:p-0">
      <div className="print-surface relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/25 bg-[#070E1F] shadow-2xl shadow-cyan-950/50">
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400" />
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/15">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                Server-Signed {algorithm} Credential
              </p>
              <h3 className="text-base font-black text-white mt-0.5">Verified Contribution Credential</h3>
              <p className="text-[11px] text-gray-400">
                Workspace: <span className="text-gray-200 font-semibold">{workspaceName}</span> · Fairness: {fairnessMethod}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close certificate modal"
            className="no-print rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-black text-white shadow-lg"
                style={{ backgroundColor: certMember.color, boxShadow: `0 0 18px ${certMember.color}55` }}
              >
                {certMember.member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-black text-white">{certMember.member.name}</h4>
                <p className="text-xs text-gray-400">{certMember.member.role}</p>
                {calibration && (
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${calibration.cls}`}>
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    Peer Calibration: {calibration.rating}/5 · {calibration.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 tabular-nums">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contribution Share</p>
                <p className="text-2xl font-black text-white">{certMember.contributionPct}%</p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Overall Score</p>
                <p className="text-2xl font-black" style={{ color: certMember.color }}>
                  {certMember.overallScore}<span className="text-xs text-gray-400 font-semibold">/100</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Voice', value: certMember.voiceScore, color: '#3B82F6' },
              { label: 'Presence', value: certMember.presenceScore, color: '#10B981' },
              { label: 'Writing', value: certMember.writingScore, color: '#F59E0B' },
              { label: 'Consistency', value: certMember.consistencyScore, color: '#06B6D4' },
            ].map((dim) => (
              <div key={dim.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between text-[11px] mb-1.5 tabular-nums">
                  <span className="text-gray-400 font-semibold">{dim.label}</span>
                  <span className="font-black text-white">{dim.value}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${dim.value}%`, backgroundColor: dim.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 tabular-nums">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Engagement Level</p>
              <p className="text-xs font-black text-emerald-400 mt-1">{certMember.engagementLevel ?? 'UNSCORED'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Active Time</p>
              <p className="text-xs font-bold text-gray-200 mt-1">
                {certMember.activeMinutes}m {certMember.sessionMinutes > 0 ? `/ ${certMember.sessionMinutes}m` : ''}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Written Output</p>
              <p className="text-xs font-bold text-gray-200 mt-1">
                {certMember.wordCount.toLocaleString()} words · {certMember.docCount} docs
              </p>
            </div>
          </div>

          {certMember.insight?.narrative && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">AI Assessment Summary</p>
              <p className="text-xs text-gray-300 leading-relaxed">{certMember.insight.narrative}</p>
            </div>
          )}

          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  {algorithm} Verification Credential ID
                </p>
                <p className="font-mono text-sm font-black tracking-wider text-white mt-0.5 select-all">
                  {signing ? 'Signing credential…' : credentialId || 'Pending…'}
                </p>
              </div>
              {navigate && credentialId && !signing && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('verify', { credentialId });
                  }}
                  className="no-print inline-flex items-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25"
                >
                  Open Verifier Page <ExternalLink size={11} />
                </button>
              )}
            </div>
            {signature && (
              <p className="font-mono text-[10px] text-gray-400 break-all">
                Signature: {signature.slice(0, 32)}…
              </p>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-4 bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 transition-all"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copied JSON' : 'Copy JSON'}
            </button>
            <button
              type="button"
              disabled={!credentialId || signing}
              onClick={() => {
                const svg = buildCertificateSvg({
                  credentialId: credentialId || 'CT-2026-UNSIGNED',
                  signature,
                  algorithm,
                  memberName: certMember.member.name,
                  memberRole: certMember.member.role,
                  workspaceName,
                  overallScore: certMember.overallScore,
                  contributionPct: certMember.contributionPct,
                  voiceScore: certMember.voiceScore,
                  presenceScore: certMember.presenceScore,
                  writingScore: certMember.writingScore,
                  consistencyScore: certMember.consistencyScore,
                  issuedAt: issuedAt || new Date().toISOString(),
                });
                const slug = certMember.member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                downloadCertificateSvg(`contributrack-${slug}-certificate.svg`, svg);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
            >
              <Download size={13} /> Download SVG Certificate
            </button>
            {credentialId && !signing ? (
              <a
                href={buildLinkedInCertUrl({
                  credentialId,
                  memberName: certMember.member.name,
                  workspaceName,
                  issuedAt: issuedAt || new Date().toISOString(),
                  verifyUrl:
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/verify/${encodeURIComponent(credentialId)}`
                      : `https://contributrack.app/verify/${encodeURIComponent(credentialId)}`,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0A66C2]/50 bg-[#0A66C2]/20 px-3.5 py-2 text-xs font-bold text-sky-200 hover:bg-[#0A66C2]/30 transition-all"
              >
                <Award size={13} /> Add to LinkedIn <ExternalLink size={11} />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-bold text-gray-500">
                <Award size={13} /> Add to LinkedIn
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all"
            >
              <Printer size={13} /> Print Credential
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
