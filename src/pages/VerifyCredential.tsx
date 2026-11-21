import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ArrowLeft, Search, Loader, Award, ExternalLink } from 'lucide-react';
import { verifyContributionCredential } from '../lib/supabase';
import { buildLinkedInCertUrl } from '../lib/certificateExport';
import type { ContributionCertificate, Page } from '../lib/types';

export default function VerifyCredential({
  credentialId: initialId = '',
  navigate,
}: {
  credentialId?: string;
  navigate: (page: Page, params?: { sessionId?: string; credentialId?: string }) => void;
}) {
  const [code, setCode] = useState(initialId);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [result, setResult] = useState<{
    verified: boolean;
    reason?: string;
    certificate: ContributionCertificate | null;
  } | null>(null);

  const runVerify = async (target: string) => {
    const clean = target.trim();
    if (!clean) return;
    setLoading(true);
    try {
      const res = await verifyContributionCredential(clean);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      setCode(initialId);
      void runVerify(initialId);
    }
  }, [initialId]);

  const cert = result?.certificate;
  const metrics = (cert?.payload?.metrics ?? {}) as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={13} /> Back to ContribuTrack
          </button>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            Cryptographic Registry
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#070E1F] p-6 shadow-2xl space-y-5">
          <div>
            <h1 className="text-lg font-black text-white">Verify Proof-of-Contribution Credential</h1>
            <p className="text-xs text-gray-400 mt-1">
              Validates the server HMAC-SHA256 signature against stored contribution telemetry.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) {
                navigate('verify', { credentialId: code.trim() });
                void runVerify(code);
              }
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter CT-2026-..."
                className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-9 pr-3 font-mono text-xs text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Verify
            </button>
          </form>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-cyan-300">
              <Loader size={16} className="animate-spin" /> Checking HMAC-SHA256 signature…
            </div>
          )}

          {!loading && result && (
            <div
              className={`rounded-2xl border p-5 space-y-4 ${
                result.verified
                  ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                  : 'border-rose-500/30 bg-rose-500/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.verified ? (
                  <ShieldCheck size={24} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <ShieldAlert size={24} className="text-rose-400 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-black ${result.verified ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {result.verified ? 'VERIFIED AUTHENTIC CREDENTIAL' : 'VERIFICATION FAILED'}
                  </p>
                  <p className="text-[11px] text-gray-300">
                    {result.verified
                      ? `Signed with ${cert?.algorithm ?? 'HMAC-SHA256'} · Issued ${cert ? new Date(cert.issued_at).toLocaleString() : ''}`
                      : result.reason ?? 'Signature mismatch or missing record.'}
                  </p>
                </div>
              </div>

              {cert && (
                <>
                  <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Recipient</p>
                      <p className="font-bold text-white mt-0.5">{cert.member_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Workspace</p>
                      <p className="font-semibold text-gray-200 mt-0.5">{cert.workspace_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Overall Score</p>
                      <p className="font-black text-cyan-300 tabular-nums mt-0.5">
                        {String(metrics.overallScore ?? '—')}/100 ({String(metrics.contributionPct ?? '—')}% share)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Credential ID</p>
                      <p className="font-mono text-[11px] text-gray-200 mt-0.5">{cert.credential_id}</p>
                    </div>
                  </div>
                  {result.verified && (
                    <div className="border-t border-white/10 pt-3 flex justify-end">
                      <a
                        href={buildLinkedInCertUrl({
                          credentialId: cert.credential_id,
                          memberName: cert.member_name,
                          workspaceName: cert.workspace_name,
                          issuedAt: cert.issued_at,
                          verifyUrl:
                            typeof window !== 'undefined'
                              ? window.location.href
                              : `https://contributrack.app/verify/${encodeURIComponent(cert.credential_id)}`,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#0A66C2]/50 bg-[#0A66C2]/20 px-3.5 py-2 text-xs font-bold text-sky-200 hover:bg-[#0A66C2]/30"
                      >
                        <Award size={13} /> Add to LinkedIn <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
