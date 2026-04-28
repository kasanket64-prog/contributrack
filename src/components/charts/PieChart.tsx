import { useState } from 'react';

interface Slice {
  label: string;
  value: number;
  color: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export default function PieChart({ data, size = 200 }: { data: Slice[]; size?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm" style={{ width: size, height: size }}>
        No data
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const ir = r * 0.52;

  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return { ...d, start, end, angle, pct: Math.round((d.value / total) * 100), idx: i };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex gap-5 items-center">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            {slices.map((s) => (
              <filter key={s.idx} id={`glow-${s.idx}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>
          {slices.map((s) =>
            s.angle > 0.5 ? (
              <path
                key={s.idx}
                d={arcPath(cx, cy, r, s.start, s.end)}
                fill={s.color}
                stroke="#0D1626"
                strokeWidth={2.5}
                opacity={hovered === null || hovered === s.idx ? 1 : 0.35}
                filter={hovered === s.idx ? `url(#glow-${s.idx})` : undefined}
                style={{
                  transform: hovered === s.idx ? `scale(1.04)` : 'scale(1)',
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(s.idx)}
                onMouseLeave={() => setHovered(null)}
              />
            ) : null
          )}
          {/* Donut hole */}
          <circle cx={cx} cy={cy} r={ir} fill="white" />
          {/* Center text */}
          {active ? (
            <>
              <text x={cx} y={cy - 10} textAnchor="middle" fontSize={13} fontWeight="800" fill={active.color}>{active.pct}%</text>
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize={9} fill="#6B7280">{active.label.slice(0, 10)}</text>
              <text x={cx} y={cy + 18} textAnchor="middle" fontSize={8} fill="#9CA3AF">{active.value} readings</text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize={16} fontWeight="900" fill="#111827">{total}</text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#9CA3AF">readings</text>
            </>
          )}
        </svg>
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        {slices.map((s) => (
          <div
            key={s.idx}
            className="flex items-center gap-2 cursor-default group"
            onMouseEnter={() => setHovered(s.idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
              style={{
                backgroundColor: s.color,
                boxShadow: hovered === s.idx ? `0 0 8px ${s.color}` : 'none',
              }}
            />
            <span className={`text-xs truncate max-w-[90px] transition-colors ${hovered === s.idx ? 'text-gray-900' : 'text-gray-500'}`}>
              {s.label}
            </span>
            <span className="ml-auto text-xs font-black" style={{ color: s.color }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
