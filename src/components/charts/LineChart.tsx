import { useId, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  label?: string;
}

export default function LineChart({ data, color = '#818CF8', height = 220, label }: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; val: number; lbl: string } | null>(null);
  const chartId = useId();
  const width = 640;
  const pad = { top: 20, right: 20, bottom: 32, left: 42 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center text-zinc-500 gap-1" style={{ height }}>
        <span className="text-xs font-medium text-zinc-400">Waiting for multiple checkpoints…</span>
        <span className="text-[11px] text-zinc-500">Additional sensor readings will plot here</span>
      </div>
    );
  }

  const safeData = data.map((d) => ({
    label: String(d.label ?? ''),
    value: Number.isFinite(d.value) ? d.value : 0,
  }));

  const rawMin = Math.min(...safeData.map((d) => d.value));
  const rawMax = Math.max(...safeData.map((d) => d.value));
  const isBinary = safeData.every((d) => d.value === 0 || d.value === 1) && rawMax <= 1 && rawMin >= 0;

  let yMin = 0;
  let yMax = 100;

  if (isBinary) {
    yMin = 0;
    yMax = 1;
  } else if (rawMin >= 0 && rawMax <= 100) {
    if (rawMax - rawMin < 24) {
      yMin = Math.max(0, Math.floor((rawMin - 12) / 5) * 5);
      yMax = Math.min(100, Math.ceil((rawMax + 12) / 5) * 5);
      if (yMax <= yMin) yMax = Math.min(100, yMin + 10);
    } else {
      yMin = Math.max(0, Math.floor((rawMin - 5) / 5) * 5);
      yMax = Math.min(100, Math.ceil((rawMax + 5) / 5) * 5);
      if (yMax <= yMin) yMax = Math.min(100, yMin + 10);
    }
  } else {
    const span = Math.max(1, rawMax - rawMin);
    yMin = Math.max(0, Math.floor(rawMin - span * 0.2));
    yMax = Math.ceil(rawMax + span * 0.2);
    if (yMax <= yMin) yMax = yMin + 10;
  }

  const range = Math.max(0.0001, yMax - yMin);
  const gradId = `${chartId}-lgrad`;

  const pts = safeData.map((d, i) => ({
    x: pad.left + (i / (safeData.length - 1)) * chartW,
    y: pad.top + chartH - ((d.value - yMin) / range) * chartH,
    d,
  }));

  const smoothPath = pts.reduce((path, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return `${path} C ${cpx} ${prev.y} ${cpx} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = `${smoothPath} L ${pts[pts.length - 1].x} ${pad.top + chartH} L ${pts[0].x} ${pad.top + chartH} Z`;

  const midTick = isBinary ? 0.5 : Math.round(((yMin + yMax) / 2) * 10) / 10;
  const yTicks = isBinary ? [0, 1] : [yMin, midTick, yMax];
  const xStep = Math.max(1, Math.floor(safeData.length / 6));

  return (
    <div>
      {label && <p className="text-xs text-zinc-400 mb-1.5">{label}</p>}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ height }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Hairline horizontal grid lines */}
          {yTicks.map((t, i) => {
            const y = pad.top + chartH - ((t - yMin) / range) * chartH;
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + chartW}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={500}
                  fill="#71717A"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Subtle gradient fill under curve */}
          <path d={areaPath} fill={`url(#${gradId})`} />

          {/* Clean primary stroke */}
          <path
            d={smoothPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive nodes */}
          {pts.map((p, i) => {
            const active = tooltip?.lbl === p.d.label;
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setTooltip({ x: p.x, y: p.y, val: p.d.value, lbl: p.d.label })}
                />
                {(pts.length <= 12 || active) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? 4.5 : 3.5}
                    fill={active ? '#FAFAFA' : color}
                    stroke="#111114"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Readable X axis labels */}
          {pts
            .filter((_, i) => i % xStep === 0 || i === pts.length - 1)
            .map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={pad.top + chartH + 22}
                textAnchor="middle"
                fontSize={11}
                fontWeight={500}
                fill="#71717A"
              >
                {p.d.label}
              </text>
            ))}

          {/* Obsidian tooltip */}
          {tooltip && (() => {
            const boxW = 84;
            const boxH = 38;
            const boxX = Math.max(pad.left, Math.min(width - pad.right - boxW, tooltip.x - boxW / 2));
            const boxY = Math.max(4, tooltip.y - boxH - 10);
            return (
              <g>
                <line
                  x1={tooltip.x}
                  y1={pad.top}
                  x2={tooltip.x}
                  y2={pad.top + chartH}
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <rect
                  x={boxX}
                  y={boxY}
                  width={boxW}
                  height={boxH}
                  rx={8}
                  fill="#18181B"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth={1}
                />
                <text
                  x={boxX + boxW / 2}
                  y={boxY + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="700"
                  fill="#FAFAFA"
                >
                  {tooltip.val}
                </text>
                <text
                  x={boxX + boxW / 2}
                  y={boxY + 29}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#A1A1AA"
                >
                  {tooltip.lbl}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
