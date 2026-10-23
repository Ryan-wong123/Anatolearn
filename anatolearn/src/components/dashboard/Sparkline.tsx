interface SparklineProps {
  values: number[];
  label: string;
}

// Tiny score trend (0-100). The aria-label spells out the numbers so the chart is not colour- or shape-only.
export default function Sparkline({ values, label }: SparklineProps) {
  const width = 96;
  const height = 32;
  const pad = 3;
  const summary = values.length ? `${label}: ${values.map((value) => `${value}%`).join(', ')}` : `${label}: no scored attempts yet`;
  if (values.length === 0) return <span role="img" aria-label={summary} className="text-xs text-slate-600 dark:text-slate-400">No scores yet</span>;
  const x = (index: number) => values.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (values.length - 1);
  const y = (value: number) => height - pad - (Math.max(0, Math.min(100, value)) / 100) * (height - pad * 2);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const improving = values.length > 1 && values[values.length - 1] >= values[0];
  const stroke = improving ? 'stroke-emerald-600 dark:stroke-emerald-400' : 'stroke-amber-600 dark:stroke-amber-400';
  const fill = improving ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-amber-600 dark:fill-amber-400';
  return (
    <svg role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} className="h-8 w-24 flex-shrink-0">
      <line x1={pad} x2={width - pad} y1={y(50)} y2={y(50)} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="2 3" strokeWidth="1" />
      {values.length > 1 && <polyline points={points} fill="none" className={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r={index === values.length - 1 ? 3 : 2} className={fill} />)}
    </svg>
  );
}
