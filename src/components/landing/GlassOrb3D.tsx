import { Mic, Eye, Award, Sparkles } from 'lucide-react';

/**
 * Layered refractive 3D glass sphere with volumetric aurora halo,
 * rotating orbital rings, caustic highlights, and floating spatial HUD cards.
 */
export default function GlassOrb3D() {
  return (
    <div className="relative mx-auto flex h-[430px] w-full max-w-[490px] items-center justify-center sm:h-[490px]">
      {/* Volumetric ambient glow behind orb */}
      <div
        className="pointer-events-none absolute h-[380px] w-[380px] rounded-full blur-[90px] animate-pulse-glow"
        style={{
          background:
            'radial-gradient(circle at 40% 35%, rgba(6,182,212,0.45), rgba(99,102,241,0.32) 48%, rgba(139,92,246,0.18) 72%, transparent 85%)',
        }}
      />

      {/* Outer orbital ring */}
      <div className="pointer-events-none absolute h-[380px] w-[380px] rounded-full border border-white/[0.08] animate-orbit sm:h-[420px] sm:w-[420px]">
        <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_16px_4px_rgba(34,211,238,0.8)]" />
        <div className="absolute bottom-8 right-7 h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_12px_3px_rgba(129,140,248,0.8)]" />
      </div>

      {/* Tilted counter-rotating caustic ring */}
      <div
        className="pointer-events-none absolute h-[320px] w-[320px] rounded-full border border-cyan-400/20 animate-orbit-reverse sm:h-[355px] sm:w-[355px]"
        style={{ transform: 'rotateX(65deg) rotateY(15deg)' }}
      >
        <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_3px_rgba(52,211,153,0.9)]" />
      </div>

      {/* Primary 3D Glass Sphere */}
      <div className="relative h-[250px] w-[250px] animate-float-slow sm:h-[296px] sm:w-[296px]">
        {/* Refractive glass body */}
        <div
          className="relative h-full w-full overflow-hidden rounded-full border border-white/25"
          style={{
            background:
              'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.42) 0%, rgba(125,211,252,0.18) 18%, rgba(99,102,241,0.22) 45%, rgba(15,23,42,0.75) 78%, rgba(3,7,18,0.95) 100%)',
            boxShadow:
              'inset -22px -28px 60px rgba(3,7,18,0.85), inset 16px 18px 36px rgba(255,255,255,0.28), inset 0 0 40px rgba(6,182,212,0.28), 0 35px 90px -20px rgba(6,182,212,0.45)',
          }}
        >
          {/* Internal volumetric aurora swirl */}
          <div
            className="absolute -left-8 -top-6 h-56 w-56 rounded-full opacity-70 blur-2xl animate-aurora"
            style={{
              background:
                'conic-gradient(from 140deg, rgba(6,182,212,0.55), rgba(99,102,241,0.55), rgba(16,185,129,0.4), rgba(139,92,246,0.5), rgba(6,182,212,0.55))',
            }}
          />

          {/* Specular VisionOS-style crescent reflection */}
          <div
            className="absolute left-6 top-4 h-24 w-36 -rotate-12 rounded-full opacity-65 blur-[2px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.06) 75%, transparent 100%)',
            }}
          />

          {/* Bottom caustic rim */}
          <div
            className="absolute bottom-3 left-1/2 h-14 w-44 -translate-x-1/2 rounded-full opacity-65 blur-md"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(34,211,238,0.75), rgba(99,102,241,0.3) 65%, transparent 100%)',
            }}
          />

          {/* Subtle inner holographic reticle */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 h-full w-full opacity-35"
            aria-hidden="true"
          >
            <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" strokeDasharray="3 5" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="rgba(34,211,238,0.55)" strokeWidth="0.7" />
            <ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" transform="rotate(-18 100 100)" />
          </svg>

          {/* Center Core Badge */}
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
            <div className="glass-pill mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider text-cyan-200">
              <Sparkles size={11} className="text-cyan-300" />
              NEURAL CORE
            </div>
            <p className="text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_16px_rgba(34,211,238,0.6)]">
              94.8%
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-cyan-100/75">
              Live Fairness Index
            </p>
          </div>
        </div>
      </div>

      {/* Floating Spatial HUD Card 1 — Top Left */}
      <div
        className="glass-panel glass-border-glow absolute left-0 top-6 z-20 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 sm:left-2 sm:top-10"
        style={{ animation: 'float-slow 5.5s ease-in-out infinite 0.5s' }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/30">
          <Mic size={16} className="text-cyan-300" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-white">Voice Quality 96/100</p>
          <p className="text-[10px] text-emerald-400">Productive · Multilingual AI</p>
        </div>
      </div>

      {/* Floating Spatial HUD Card 2 — Middle Right */}
      <div
        className="glass-panel glass-border-glow absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center gap-3 rounded-2xl px-3.5 py-2.5 sm:-right-2"
        style={{ animation: 'float-slow 6.5s ease-in-out infinite 1.1s' }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-400/30">
          <Eye size={16} className="text-emerald-300" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-white">Facial Presence</p>
          <p className="text-[10px] text-cyan-300">ENGAGED · FOCUSED</p>
        </div>
      </div>

      {/* Floating Spatial HUD Card 3 — Bottom Left */}
      <div
        className="glass-panel glass-border-glow absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 sm:bottom-6 sm:left-6"
        style={{ animation: 'float-slow 7s ease-in-out infinite 1.8s' }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-600/30 border border-indigo-400/30">
          <Award size={16} className="text-indigo-300" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-white">Zero Bias Scoring</p>
          <p className="text-[10px] text-gray-400">Voice + Vision + Docs</p>
        </div>
      </div>
    </div>
  );
}
