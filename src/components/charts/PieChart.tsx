import { useMemo, useState } from 'react';

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: Slice[];
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export default function PieChart({ data, size = 180 }: PieChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const safeData = useMemo(
    () =>
      (data ?? [])
        .map((d) => ({
          label: String(d?.label ?? ''),
          value: Number.isFinite(d?.value) ? Math.max(0, d.value) : 0,
          color: d?.color || '#818CF8',
        }))
        .filter((d) => d.value > 0),
    [data],
  );

  const total = safeData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-500" style={{ width: size, height: size }}>
        No data
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const ir = r * 0.58;

  let currentAngle = 0;

  const slices = safeData.map((d, i) => {
    const angle = (d.value / total) * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;

    return {
      ...d,
      start,
      end,
      angle,
      pct: Math.round((d.value / total) * 100),
      idx: i,
    };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s) =>
            s.angle > 0.5 ? (
              <path
                key={s.idx}
                d={arcPath(cx, cy, r, s.start, s.end)}
                fill={s.color}
                stroke="#111114"
                strokeWidth={2.5}
                opacity={hovered === null || hovered === s.idx ? 0.92 : 0.3}
                style={{
                  transform: hovered === s.idx ? 'scale(1.03)' : 'scale(1)',
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(s.idx)}
                onMouseLeave={() => setHovered(null)}
              />
            ) : null,
          )}

          {/* Seamless Obsidian donut center */}
          <circle cx={cx} cy={cy} r={ir} fill="#111114" />

          {active ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize={16} fontWeight="700" fill="#FAFAFA">
                {active.pct}%
              </text>
              <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10} fill="#A1A1AA">
                {active.label.length > 12 ? `${active.label.slice(0, 12)}…` : active.label}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 3} textAnchor="middle" fontSize={18} fontWeight="700" fill="#FAFAFA">
                {slices.length}
              </text>
              <text x={cx} y={cy + 13} textAnchor="middle" fontSize={10} fill="#71717A">
                members
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {slices.map((s) => (
          <div
            key={s.idx}
            className="flex cursor-default items-center gap-2.5 text-xs"
            onMouseEnter={() => setHovered(s.idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className={`max-w-[130px] truncate transition-colors ${hovered === s.idx ? 'text-white' : 'text-zinc-400'}`}>
              {s.label}
            </span>
            <span className="ml-auto font-mono font-semibold tabular-nums text-zinc-200">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
