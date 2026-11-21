import { useState } from 'react';
import {
  Activity,
  Mic,
  Eye,
  FileText,
  Sparkles,
  CheckCircle2,
  Laptop,
  AlertTriangle,
  Moon,
  ArrowUpRight,
} from 'lucide-react';

type ShowcaseTabId = 'telemetry' | 'voice' | 'vision' | 'fairness';

const TABS: {
  id: ShowcaseTabId;
  label: string;
  eyebrow: string;
  icon: typeof Activity;
  summary: string;
}[] = [
  {
    id: 'telemetry',
    label: 'Live Telemetry',
    eyebrow: '30s Edge Intervals',
    icon: Activity,
    summary:
      'Every paired IoT node streams signed audio-visual signals over a single REST call into real-time team heatmaps.',
  },
  {
    id: 'voice',
    label: 'Voice Intelligence',
    eyebrow: 'Multilingual LLM',
    icon: Mic,
    summary:
      'Classifies speech quality (Productive, Neutral, Off-Topic, Disruptive) across languages with automatic topic extraction.',
  },
  {
    id: 'vision',
    label: 'Spatial Presence',
    eyebrow: '6 Expression States',
    icon: Eye,
    summary:
      'Distinguishes heads-down laptop focus from distraction or drowsiness so quiet builders earn full credit.',
  },
  {
    id: 'fairness',
    label: 'Fairness & Docs',
    eyebrow: 'StdDev · Gini · Range',
    icon: FileText,
    summary:
      'Extracts text from PDF, DOCX, PPTX, and XLSX deliverables and balances them against live participation.',
  },
];

export default function InteractiveShowcase({ onLaunch }: { onLaunch: () => void }) {
  const [activeTab, setActiveTab] = useState<ShowcaseTabId>('telemetry');

  return (
    <div className="glass-panel relative overflow-hidden rounded-[28px] p-4 sm:p-8">
      {/* Subtle internal volumetric light */}
      <div className="pointer-events-none absolute -top-28 left-1/3 h-64 w-96 rounded-full bg-cyan-500/15 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-28 right-1/4 h-64 w-96 rounded-full bg-indigo-500/15 blur-[100px]" />

      {/* Top 4 interactive pill tabs */}
      <div className="relative z-10 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`group flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                active
                  ? 'border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-transparent shadow-[0_0_30px_-10px_rgba(6,182,212,0.45)]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
              }`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  active
                    ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-gray-400 group-hover:text-white'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
                  {t.eyebrow}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">{t.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Holographic Interactive Viewport */}
      <div className="relative z-10 mt-6 grid grid-cols-12 gap-6 rounded-2xl border border-white/[0.08] bg-[#040914]/90 p-5 sm:p-7">
        {/* Left explanation column */}
        <div className="col-span-12 flex flex-col justify-between lg:col-span-4">
          <div>
            <div className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-cyan-300">
              <Sparkles size={12} />
              {TABS.find((t) => t.id === activeTab)?.eyebrow}
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-white">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-gray-400">
              {TABS.find((t) => t.id === activeTab)?.summary}
            </p>
          </div>

          <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Inference Engine</span>
              <span className="font-mono text-cyan-300">Gemini · Groq · Claude · Local</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Device Auth</span>
              <span className="font-mono text-emerald-300">Per-Member Secret</span>
            </div>
            <button
              type="button"
              onClick={onLaunch}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] hover:shadow-cyan-500/40"
            >
              Try Interactive Demo
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Right holographic visual panel */}
        <div className="col-span-12 lg:col-span-8">
          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs font-semibold text-gray-300">
                    STREAM · CAPSTONE SPRINT PLANNING
                  </span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400">100 readings · 0ms drop</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Priya Patel', role: 'Research & Pipeline', score: 92, pct: 40, state: 'FOCUSED', color: '#10B981' },
                  { name: 'Aarav Sharma', role: 'Team Lead', score: 90, pct: 33, state: 'ENGAGED', color: '#06B6D4' },
                  { name: 'Rohan Mehta', role: 'Slides & QA', score: 61, pct: 19, state: 'NEUTRAL', color: '#F59E0B' },
                  { name: 'Sneha Iyer', role: 'Reviewer', score: 24, pct: 8, state: 'DROWSY', color: '#F43F5E' },
                ].map((m) => (
                  <div
                    key={m.name}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-[140px] flex-1">
                      <p className="text-xs font-semibold text-white">{m.name}</p>
                      <p className="text-[11px] text-gray-500">{m.role}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-gray-300">
                      {m.state}
                    </span>
                    <div className="w-36 sm:w-44">
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${m.score}%`,
                            backgroundColor: m.color,
                            boxShadow: `0 0 12px ${m.color}80`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-12 text-right font-mono text-xs font-bold" style={{ color: m.color }}>
                      {m.score}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                  Incoming Transcript Sample
                </p>
                <p className="mt-2 text-sm italic text-gray-200">
                  “Let&apos;s split the methodology draft into three milestones and benchmark the voice pipeline before Friday&apos;s review.”
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-gray-500">Quality Verdict</p>
                  <p className="mt-1 text-lg font-black text-emerald-400">PRODUCTIVE</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">Score: 88 / 100</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-gray-500">Sentiment &amp; Lang</p>
                  <p className="mt-1 text-lg font-black text-cyan-300">POSITIVE</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">ISO-639: en / auto</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-gray-500">Detected Topics</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['methodology', 'pipeline', 'milestones'].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] text-indigo-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vision' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  state: 'ENGAGED',
                  range: '80 – 100 pts',
                  desc: 'Alert posture, eye contact, active discussion participation.',
                  color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
                  icon: CheckCircle2,
                },
                {
                  state: 'FOCUSED',
                  range: '65 – 85 pts',
                  desc: 'Looking down at laptop or notebook — rewarded as active work.',
                  color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
                  icon: Laptop,
                },
                {
                  state: 'DISTRACTED',
                  range: '20 – 35 pts',
                  desc: 'Repeatedly checking phone or looking away from team workspace.',
                  color: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
                  icon: AlertTriangle,
                },
                {
                  state: 'DROWSY',
                  range: '5 – 15 pts',
                  desc: 'Passive presence flagged automatically so sleeping is not scored high.',
                  color: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
                  icon: Moon,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.state} className={`rounded-xl border p-4 ${item.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-mono text-xs font-bold">
                        <Icon size={14} />
                        {item.state}
                      </span>
                      <span className="font-mono text-[11px] opacity-85">{item.range}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-300">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'fairness' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { file: 'Methodology_Draft.pdf', words: '2,310 words', score: '92%' },
                  { file: 'Project_Proposal.docx', words: '1,840 words', score: '84%' },
                  { file: 'Presentation_Outline.pptx', words: '520 words', score: '58%' },
                ].map((doc) => (
                  <div
                    key={doc.file}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
                  >
                    <p className="truncate text-xs font-semibold text-white">{doc.file}</p>
                    <p className="mt-1 font-mono text-[11px] text-gray-400">{doc.words}</p>
                    <p className="mt-2 font-mono text-xs font-bold text-cyan-300">
                      Writing Score {doc.score}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/[0.06] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Composite Team Fairness Index</span>
                  <span className="font-mono font-bold text-emerald-400">StdDev · Gini · Range</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  Combines Voice (18%), Voice Content (12%), Presence (20%), True Active Time (20%), Writing (15%), and Consistency (15%).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
