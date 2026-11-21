import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export function MiniParticles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let id: number;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const pts = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() + 0.4,
      a: Math.random() * 0.25 + 0.05,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(161,161,170,${p.a})`;
        ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        const start = Date.now();
        const dur = 750;
        const tick = () => {
          const t = Math.min((Date.now() - start) / dur, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(ease * to));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

export function PulseDot({ color = 'bg-emerald-400' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

export function GlassCard({ children, className = '', glow }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.08] bg-[#111114] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden transition-colors duration-200 hover:border-white/[0.13] ${className}`}
    >
      {glow && <div className={`hidden ${glow}`} />}
      {children}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  gradient?: string;
  glowClass?: string;
  iconColor?: string;
}) {
  return (
    <GlassCard>
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
          <Icon size={15} className="text-zinc-500" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-white leading-none tabular-nums">
          <CountUp to={value} suffix={suffix} />
        </p>
        <p className="text-xs text-zinc-400 mt-1.5">{sub}</p>
      </div>
    </GlassCard>
  );
}

export function DonutRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${(Math.max(0, Math.min(100, value)) / 100) * circ} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function strokeArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(startDeg);
  const end = toXY(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function FairnessGauge({ score }: { score: number }) {
  const clamped = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const color = clamped >= 75 ? '#10B981' : clamped >= 50 ? '#F59E0B' : '#F43F5E';
  const statusText = clamped >= 75 ? 'Balanced' : clamped >= 50 ? 'Moderate' : 'Needs Attention';
  const pillCls =
    clamped >= 75
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
      : clamped >= 50
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      : 'border-rose-500/25 bg-rose-500/10 text-rose-300';

  const cx = 92;
  const cy = 78;
  const r = 60;
  const startDeg = 150;
  const totalSweep = 240;
  const endTrackDeg = startDeg + totalSweep;
  const endValueDeg = startDeg + (clamped / 100) * totalSweep;

  const trackD = strokeArcPath(cx, cy, r, startDeg, endTrackDeg);
  const valueD = clamped > 0 ? strokeArcPath(cx, cy, r, startDeg, endValueDeg) : '';

  return (
    <div className="flex flex-col items-center">
      <svg width={184} height={138} viewBox="0 0 184 138" role="img" aria-label={`Fairness score ${clamped} out of 100, ${statusText}`}>
        <path
          d={trackD}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={11}
          strokeLinecap="round"
        />
        {clamped > 0 && (
          <path
            d={valueD}
            fill="none"
            stroke={color}
            strokeWidth={11}
            strokeLinecap="round"
          />
        )}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          fontSize={34}
          fontWeight={600}
          fill="#FAFAFA"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {clamped}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fontWeight={500} fill="#71717A">
          / 100
        </text>
      </svg>
      <span className={`-mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${pillCls}`}>
        {statusText}
      </span>
    </div>
  );
}

export function ScoreDial({ value, color, label, sub }: { value: number; color: string; label: string; sub: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-3 text-center flex flex-col items-center gap-1.5">
      <div className="relative w-11 h-11">
        <DonutRing value={value} color={color} size={44} />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <p className="text-[11px] font-semibold text-zinc-200">{label}</p>
      <p className="text-[10px] text-zinc-500 leading-tight">{sub}</p>
    </div>
  );
}
