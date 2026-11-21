import { useId, useState } from 'react';

interface Bar {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_COLORS = ['#818CF8', '#34D399', '#FBBF24', '#F87171', '#38BDF8', '#A78BFA'];

export default function BarChart({
  data,
  height = 175,
  maxValue,
}: {
  data: Bar[];
  height?: number;
  maxValue?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const chartId = useId();

  const width = 520;
  const pad = { top: 24, right: 16, bottom: 34, left: 42 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-zinc-500 text-xs" style={{ height }}>
        No data
      </div>
    );
  }

  const safeData = data.map((d) => ({
    ...d,
    value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0,
  }));

  const max = Math.max(maxValue ?? Math.max(...safeData.map((d) => d.value), 1), 1);
  const barW = Math.min(44, (chartW / safeData.length) * 0.52);
  const gap = chartW / safeData.length;
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      onMouseLeave={() => setHovered(null)}
    >
      <defs>
        {safeData.map((d, i) => {
          const c = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <linearGradient key={i} id={`${chartId}-bgrad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.95" />
              <stop offset="100%" stopColor={c} stopOpacity="0.55" />
            </linearGradient>
          );
        })}
      </defs>

      {/* Hairline dashed horizontal gridlines */}
      {yTicks.map((t, i) => {
        const y = pad.top + chartH - (t / max) * chartH;
        return (
          <g key={i}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + chartW}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={11} fontWeight={500} fill="#71717A">
              {t}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {safeData.map((d, i) => {
        const bh = Math.max(3, (d.value / max) * chartH);
        const x = pad.left + gap * i + (gap - barW) / 2;
        const y = pad.top + chartH - bh;
        const isHovered = hovered === i;

        return (
          <g key={i} onMouseEnter={() => setHovered(i)} style={{ cursor: 'pointer' }}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              fill={`url(#${chartId}-bgrad-${i})`}
              rx={6}
              opacity={hovered === null || isHovered ? 1 : 0.38}
              style={{ transition: 'opacity 0.15s ease' }}
            />

            <text
              x={x + barW / 2}
              y={pad.top + chartH + 22}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill={isHovered ? '#FAFAFA' : '#71717A'}
            >
              {d.label.length > 9 ? `${d.label.slice(0, 8)}…` : d.label}
            </text>

            {isHovered ? (
              <g>
                <rect
                  x={Math.max(pad.left, Math.min(width - pad.right - 52, x + barW / 2 - 26))}
                  y={Math.max(2, y - 24)}
                  width={52}
                  height={20}
                  rx={6}
                  fill="#18181B"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1}
                />
                <text
                  x={Math.max(pad.left + 26, Math.min(width - pad.right - 26, x + barW / 2))}
                  y={Math.max(15, y - 10)}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="700"
                  fill="#FAFAFA"
                >
                  {d.value}
                </text>
              </g>
            ) : (
              <text
                x={x + barW / 2}
                y={y - 7}
                textAnchor="middle"
                fontSize={11}
                fontWeight="600"
                fill="#A1A1AA"
              >
                {d.value}
              </text>
            )}
          </g>
        );
      })}

      <line
        x1={pad.left}
        y1={pad.top + chartH}
        x2={pad.left + chartW}
        y2={pad.top + chartH}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
    </svg>
  );
}
