import { useState } from 'react';
import { ChevronDown, ChevronUp, Tag } from 'lucide-react';
import {
  EXPR_META,
  QUALITY_META,
  SENTIMENT_META,
  type FaceExpression,
  type VoiceAnalysis,
} from './iotConstants';

export function EngagementRing({ score, isActive }: { score: number; isActive: boolean }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-14 h-14 flex-shrink-0 tabular-nums">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-bold text-white leading-none">{score}</span>
        {isActive ? <span className="text-[8px] text-emerald-400 font-semibold">ACTIVE</span> : <span className="text-[8px] text-gray-400 font-semibold">PASSIVE</span>}
      </div>
    </div>
  );
}

export function VoiceAnalysisCard({ analysis, transcript }: { analysis: VoiceAnalysis; transcript: string }) {
  const qm = QUALITY_META[analysis.voice_quality];
  const sm = SENTIMENT_META[analysis.voice_sentiment];
  const QIcon = qm.icon;
  const SIcon = sm.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 ${qm.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QIcon size={13} className={qm.color} />
          <span className={`text-xs font-bold ${qm.color}`}>{qm.label}</span>
          {analysis.detected_language && analysis.detected_language !== 'en' && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/8 text-gray-300 border border-white/10 uppercase">
              {analysis.detected_language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <SIcon size={11} className={sm.color} />
          <span className={`text-[10px] font-semibold ${sm.color}`}>{sm.label}</span>
          <span className="text-xs font-mono font-bold text-white">{analysis.voice_quality_score}/100</span>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700" style={{ width: `${analysis.voice_quality_score}%` }} />
      </div>
      {analysis.voice_summary && <p className="text-[11px] text-gray-300 leading-relaxed">{analysis.voice_summary}</p>}
      {analysis.voice_topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.voice_topics.map((t, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] bg-white/5 border border-white/8 text-gray-300 px-1.5 py-0.5 rounded-full">
              <Tag size={8} />{t}
            </span>
          ))}
        </div>
      )}
      {analysis.voice_flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.voice_flags.map((f, i) => (
            <span key={i} className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-semibold">{f}</span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors">
        {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />} {expanded ? 'Hide transcript' : 'Show transcript'}
      </button>
      {expanded && <p className="text-[11px] text-gray-300 italic border-t border-white/5 pt-2 leading-relaxed">&ldquo;{transcript}&rdquo;</p>}
    </div>
  );
}

export function ExpressionPicker({ value, onChange }: { value: FaceExpression; onChange: (v: FaceExpression) => void }) {
  const expressions: FaceExpression[] = ['ENGAGED', 'FOCUSED', 'NEUTRAL', 'DISTRACTED', 'DROWSY', 'ABSENT'];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
      {expressions.map((expr) => {
        const m = EXPR_META[expr];
        const Icon = m.icon;
        const active = value === expr;
        return (
          <button
            key={expr}
            type="button"
            onClick={() => onChange(expr)}
            className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center transition-all ${
              active ? `${m.activeBg} border-current ${m.activeColor}` : `bg-white/[0.02] border-white/8 ${m.color} hover:border-white/20`
            }`}
          >
            <Icon size={15} />
            <span className="text-[9px] font-bold leading-none">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
