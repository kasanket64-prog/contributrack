import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Send, Cpu, CheckCircle, AlertCircle, Loader, Copy, RefreshCw,
  Mic, Eye, MessageSquare, Moon, Smartphone, Laptop,
} from 'lucide-react';
import { supabase, postIotReading, IOT_FUNCTION_URL, IS_DEMO_MODE, SUPABASE_ANON_KEY_PREVIEW } from '../lib/supabase';
import { useWorkspaceId } from '../hooks/useWorkspaceQueries';
import {
  EngagementRing,
  ExpressionPicker,
  VoiceAnalysisCard,
} from '../components/iot/ExpressionPicker';
import {
  EXPR_META,
  LEVEL_COLORS,
  type FaceExpression,
  type TestResult,
  type VoiceAnalysis,
} from '../components/iot/iotConstants';
import LiveBrowserSensorCard from '../components/iot/LiveBrowserSensorCard';
import type { Member, Session } from '../lib/types';

export default function IoTDevice() {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();

  const { data } = useQuery({
    queryKey: ['iot-setup', workspaceId],
    queryFn: async ({ signal }) => {
      const [mRes, sRes] = await Promise.all([
        supabase.from('members').select('*').eq('workspace_id', workspaceId).order('name').abortSignal(signal),
        supabase.from('sessions').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('created_at', { ascending: false }).abortSignal(signal),
      ]);
      return {
        members: (mRes.data ?? []) as Member[],
        sessions: (sRes.data ?? []) as Session[],
      };
    },
  });

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  const [deviceId, setDeviceId] = useState('');
  const [voice, setVoice] = useState(1);
  const [face, setFace] = useState(1);
  const [faceExpression, setFaceExpression] = useState<FaceExpression>('ENGAGED');
  const [sessionId, setSessionId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const firstPaired = members.find((m) => m.device_id);
    if (firstPaired?.device_id && !members.some((m) => m.device_id === deviceId)) {
      setDeviceId(firstPaired.device_id);
    }
  }, [members, deviceId]);

  useEffect(() => {
    setSessionId('');
  }, [workspaceId]);

  const handleExpressionChange = (expr: FaceExpression) => {
    setFaceExpression(expr);
    setFace(expr === 'ABSENT' ? 0 : 1);
  };

  const selectedMember = members.find((m) => m.device_id === deviceId);
  const deviceSecret = selectedMember?.device_secret ?? '';

  const appendResult = (res: TestResult) => {
    setResults((r) => [res, ...r.slice(0, 14)]);
    void qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        device_id: deviceId,
        device_secret: deviceSecret,
        voice,
        face,
        face_expression: faceExpression,
      };
      if (sessionId) body.session = sessionId;
      if (transcript.trim() && voice === 1) body.transcript = transcript.trim();

      const { ok, data: resData } = await postIotReading(body);
      appendResult({
        success: ok,
        contribution_level: resData.contribution_level as string | undefined,
        contribution_pct: resData.contribution_pct as number | undefined,
        engagement_score: resData.engagement_score as number | undefined,
        is_actively_engaged: resData.is_actively_engaged as boolean | undefined,
        passive_presence: resData.passive_presence as boolean | undefined,
        face_expression: faceExpression,
        voice_analysis: (resData.voice_analysis as VoiceAnalysis | null | undefined) ?? null,
        transcript: transcript.trim() || undefined,
        error: resData.error as string | undefined,
        ts: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      appendResult({ success: false, error: String(err), ts: new Date().toLocaleTimeString() });
    } finally {
      setSending(false);
    }
  };

  const curlCommand = `curl -X POST "${IOT_FUNCTION_URL}" \\\n  -H "Content-Type: application/json" \\\n  -H "Apikey: ${SUPABASE_ANON_KEY_PREVIEW}" \\\n  -d '${JSON.stringify({ device_id: deviceId, device_secret: deviceSecret || '<paired member device secret>', voice, face, face_expression: faceExpression, ...(sessionId ? { session: sessionId } : {}), ...(transcript.trim() && voice === 1 ? { transcript: transcript.trim() } : {}) })}'`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exprM = EXPR_META[faceExpression];

  return (
    <div className="min-h-full p-6 space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">IoT Device Simulator &amp; Browser Sensor</h2>
        <p className="text-xs text-gray-400 mt-0.5">Simulate hardware readings or stream live webcam &amp; audio engagement scoring</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-[#0D1626] border border-white/8 rounded-2xl p-6 space-y-5">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm"><Cpu size={15} className="text-blue-400" /> Send IoT Reading</h3>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Device ID</label>
              <div className="flex gap-2">
                <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="device_1"
                  className="flex-1 px-3 py-2.5 text-sm bg-black/30 border border-white/8 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 font-mono" />
                {members.filter((m) => m.device_id).length > 0 && (
                  <select value={deviceId} onChange={(e) => { if (e.target.value) setDeviceId(e.target.value); }}
                    className="px-3 py-2.5 text-sm bg-black/30 border border-white/8 rounded-xl text-gray-300 focus:outline-none focus:border-blue-500/50">
                    <option value="">Pick member</option>
                    {members.filter((m) => m.device_id).map((m) => <option key={m.id} value={m.device_id!}>{m.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1"><Mic size={11} className="text-blue-400" /> Microphone Signal</label>
              <div className="flex gap-2">
                {[0, 1].map((v) => (
                  <button key={v} type="button" onClick={() => setVoice(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${voice === v ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-200'}`}>
                    {v === 1 ? 'Voice ON' : 'Voice OFF'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <Eye size={11} className="text-emerald-400" /> Camera — Face Expression
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${exprM.bg} ${exprM.border} ${exprM.color}`}>{exprM.label}</span>
              </label>
              <ExpressionPicker value={faceExpression} onChange={handleExpressionChange} />
              {faceExpression === 'FOCUSED' && (
                <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                  <Laptop size={12} className="text-cyan-400 flex-shrink-0" /><p className="text-[11px] text-cyan-300"><span className="font-bold">Focused on laptop</span> — Score 60–80 range.</p>
                </div>
              )}
              {faceExpression === 'DROWSY' && (
                <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                  <Moon size={12} className="text-orange-400 flex-shrink-0" /><p className="text-[11px] text-orange-300"><span className="font-bold">Drowsy detected</span> — passive presence (score 5–15).</p>
                </div>
              )}
              {faceExpression === 'DISTRACTED' && (
                <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <Smartphone size={12} className="text-amber-400 flex-shrink-0" /><p className="text-[11px] text-amber-300"><span className="font-bold">Distracted detected</span> — partial credit (score 20–30).</p>
                </div>
              )}
            </div>

            {sessions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Link to Session (optional)</label>
                <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-black/30 border border-white/8 rounded-xl text-gray-300">
                  <option value="">No session</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={11} className="text-amber-400" /> Voice Transcript
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold border whitespace-nowrap ${voice === 1 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                  {voice === 1 ? (IS_DEMO_MODE ? 'local rule-based analyzer' : 'any language — AI analyses') : 'voice must be ON'}
                </span>
              </label>
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={voice === 1 ? 'Paste what was said in any language…' : 'Turn voice ON to enable transcript analysis'} disabled={voice === 0} rows={3}
                className="w-full px-3 py-2.5 text-sm bg-black/30 border border-white/8 rounded-xl text-white placeholder-gray-500 resize-none disabled:opacity-30" />
            </div>

            <button type="button" onClick={() => void handleSend()} disabled={sending || !deviceId.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
              {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending…' : 'Send to IoT Endpoint'}
            </button>
          </div>

          <div className="bg-[#0D1626] border border-white/8 rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-1">Bulk Simulate</h3>
            <p className="text-xs text-gray-400 mb-3">Random expressions + voice for all members in this workspace</p>
            <button
              type="button"
              onClick={async () => {
                const EXPRS: FaceExpression[] = ['ENGAGED', 'FOCUSED', 'FOCUSED', 'NEUTRAL', 'DISTRACTED', 'DROWSY'];
                const devMembers = members.filter((m) => m.device_id);
                for (const m of devMembers) {
                  const v = Math.random() > 0.3 ? 1 : 0;
                  const expr = EXPRS[Math.floor(Math.random() * EXPRS.length)];
                  await postIotReading({ device_id: m.device_id, device_secret: m.device_secret, voice: v, face: expr === 'ABSENT' ? 0 : 1, face_expression: expr, ...(sessionId ? { session: sessionId } : {}) });
                }
                appendResult({ success: true, contribution_level: 'BULK', ts: new Date().toLocaleTimeString() });
              }}
              disabled={members.filter((m) => m.device_id).length === 0}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/8 text-gray-300 py-2.5 rounded-xl hover:bg-white/8 font-medium text-sm disabled:opacity-40"
            >
              <RefreshCw size={14} /> Simulate All ({members.filter((m) => m.device_id).length} devices)
            </button>
          </div>

          <LiveBrowserSensorCard deviceId={deviceId} deviceSecret={deviceSecret} sessionId={sessionId} onResult={appendResult} />
        </div>

        <div className="space-y-4">
          <div className="bg-[#0D1626] border border-white/8 rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-4">Response Log</h3>
            {results.length === 0 ? (
              <div className="text-center py-10 text-gray-400"><Send size={22} className="mx-auto mb-2 opacity-30" /><p className="text-xs">Send a reading to see results</p></div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {results.map((r, i) => {
                  const exprInfo = r.face_expression ? EXPR_META[r.face_expression] : null;
                  const EIcon = exprInfo?.icon;
                  return (
                    <div key={i} className={`rounded-xl border p-3.5 space-y-3 ${r.success ? 'bg-white/[0.02] border-white/8' : 'bg-red-500/5 border-red-500/15'}`}>
                      <div className="flex items-center gap-3">
                        {r.success ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" /> : <AlertCircle size={13} className="text-red-400 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          {r.success ? <p className="text-xs font-semibold text-gray-200">{r.contribution_level === 'BULK' ? 'Bulk simulation complete' : `${r.contribution_level} — ${r.contribution_pct}% contribution`}</p> : <p className="text-xs font-medium text-red-400 truncate">{r.error}</p>}
                        </div>
                        <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">{r.ts}</span>
                      </div>
                      {r.success && r.engagement_score !== undefined && r.contribution_level !== 'BULK' && (
                        <div className="flex items-center gap-3">
                          <EngagementRing score={r.engagement_score} isActive={r.is_actively_engaged ?? false} />
                          <div className="flex-1 space-y-1.5">
                            {exprInfo && EIcon && <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${exprInfo.bg} ${exprInfo.border} ${exprInfo.color}`}><EIcon size={11} />{exprInfo.label}</div>}
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold ${r.is_actively_engaged ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{r.is_actively_engaged ? 'Actively Engaged' : 'Not Engaged'}</span>
                              {r.contribution_level && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[r.contribution_level] ?? ''}`}>{r.contribution_level}</span>}
                            </div>
                          </div>
                        </div>
                      )}
                      {r.voice_analysis && r.transcript && <VoiceAnalysisCard analysis={r.voice_analysis} transcript={r.transcript} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#0D1626] border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">cURL Command</h3>
              <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
                {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-black/50 text-emerald-400 text-[11px] p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed border border-white/5">{curlCommand}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
