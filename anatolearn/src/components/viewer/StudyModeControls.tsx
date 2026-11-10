import { useEffect, useState } from 'react';
import type { Annotation } from './types';

export type StudyMode = 'explore' | 'overview' | 'revision';
export interface StudyLabelPoint { id: number; x: number; y: number }

interface Props {
  mode: StudyMode;
  annotations: Annotation[];
  selected: Annotation | null;
  onStep: (offset: number) => void;
  labels: StudyLabelPoint[];
  viewport: { width: number; height: number };
}

type PositionedLabel = {
  point: StudyLabelPoint;
  annotation: Annotation;
  x: number;
  y: number;
  side: 'left' | 'right';
};

function distributeLabels(labels: PositionedLabel[], height: number): PositionedLabel[] {
  if (!labels.length) return labels;
  const top = 116;
  const bottom = Math.max(top + 40, height - 56);
  const rowHeight = 30;
  const gap = labels.length > 1 ? Math.min(rowHeight, (bottom - top) / (labels.length - 1)) : 0;
  const ordered = [...labels].sort((a, b) => a.point.y - b.point.y);
  let lastY = top - gap;
  return ordered.map((item, index) => {
    const remaining = ordered.length - index - 1;
    const upperLimit = bottom - remaining * gap;
    const y = Math.max(top, Math.min(upperLimit, Math.max(item.point.y - 12, lastY + gap)));
    lastY = y;
    return { ...item, y };
  });
}

// Keep each label on its previous side until its anchor crosses a wide central
// band. This prevents late OrbitControls damping from flipping labels back and
// forth when the camera settles near the middle of the viewport.
const SIDE_HYSTERESIS_FRACTION = 0.14;

export default function StudyModeControls({ mode, annotations, selected, onStep, labels, viewport }: Props) {
  const selectedIndex = annotations.findIndex((annotation) => annotation.id === selected?.id);
  const labelWidth = Math.min(178, Math.max(120, viewport.width * 0.21));
  const midpoint = viewport.width / 2;
  const [sideById, setSideById] = useState<Record<number, 'left' | 'right'>>({});

  useEffect(() => {
    if (mode !== 'overview' || viewport.width === 0) return;
    const threshold = viewport.width * SIDE_HYSTERESIS_FRACTION;
    setSideById((previous) => {
      let next: Record<number, 'left' | 'right'> | null = null;
      for (const point of labels) {
        const priorSide = previous[point.id];
        const desiredSide = priorSide == null
          ? (point.x < midpoint ? 'left' : 'right')
          : priorSide === 'left'
            ? (point.x > midpoint + threshold ? 'right' : 'left')
            : (point.x < midpoint - threshold ? 'left' : 'right');
        if (desiredSide !== priorSide) {
          if (!next) next = { ...previous };
          next[point.id] = desiredSide;
        }
      }
      return next ?? previous;
    });
  }, [labels, midpoint, mode, viewport.width]);

  const available = labels.map((point) => ({ point, annotation: annotations.find((item) => item.id === point.id) }))
    .filter((entry): entry is { point: StudyLabelPoint; annotation: Annotation } => Boolean(entry.annotation));

  // Keep labels near the model instead of at the browser's far edges. Use a
  // stable central corridor; only shift it outward when zooming brings an
  // annotation anchor too close to a label.
  const nearestAnchorLeft = available.length ? Math.min(...available.map(({ point }) => point.x)) : midpoint;
  const nearestAnchorRight = available.length ? Math.max(...available.map(({ point }) => point.x)) : midpoint;
  const leftEnd = Math.max(labelWidth + 16, Math.min(midpoint - 280, nearestAnchorLeft - 30));
  const rightStart = Math.min(viewport.width - labelWidth - 16, Math.max(midpoint + 280, nearestAnchorRight + 30));
  const leftX = Math.max(16, leftEnd - labelWidth);
  const rightX = Math.max(16, rightStart);

  const left = distributeLabels(available.filter(({ point }) => (sideById[point.id] ?? (point.x < midpoint ? 'left' : 'right')) === 'left')
    .map(({point, annotation}) => ({point, annotation, x: leftX, y: point.y, side: 'left' as const})), viewport.height);
  const right = distributeLabels(available.filter(({ point }) => (sideById[point.id] ?? (point.x < midpoint ? 'left' : 'right')) === 'right')
    .map(({point, annotation}) => ({point, annotation, x: rightX, y: point.y, side: 'right' as const})), viewport.height);
  const positioned = [...left, ...right];

  return <>
    {mode === 'overview' && viewport.width > 0 && (
      <>
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" aria-hidden="true">
          {positioned.map(({ annotation, point, x, y, side }) => {
            const endX = side === 'left' ? x + labelWidth : x;
            return <g key={annotation.id}>
              <path d={`M ${point.x} ${point.y} L ${endX} ${y + 13}`}
                fill="none" stroke={annotation.color ?? '#0e7490'} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
              <circle cx={point.x} cy={point.y} r="3.5" fill={annotation.color ?? '#0e7490'} stroke="white" strokeWidth="1" />
            </g>;
          })}
        </svg>
        {positioned.map(({annotation, x, y}) => (
          <div key={annotation.id} role="text" aria-label={annotation.label}
            style={{left:x, top:y, width:labelWidth, borderLeftColor:annotation.color ?? '#0e7490'}}
            className="pointer-events-none absolute z-20 truncate rounded border border-l-4 border-slate-200 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-white">
            {annotation.label}
          </div>
        ))}
        <p className="pointer-events-none absolute bottom-3 left-4 z-20 rounded bg-white/80 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
          Overview · {positioned.length} labels in view · Rotate to see other structures
        </p>
      </>
    )}
    {mode === 'revision' && (
      <nav aria-label="Revision navigation" className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900/95"
        onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" disabled={selectedIndex <= 0} onClick={() => onStep(-1)}
          className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-900 disabled:opacity-40 dark:bg-slate-800 dark:text-white">← Previous</button>
        <span className="min-w-16 text-center text-xs font-semibold text-slate-800 dark:text-slate-100">
          {annotations.length ? `${Math.max(0, selectedIndex) + 1} / ${annotations.length}` : 'No annotations'}
        </span>
        <button type="button" disabled={selectedIndex < 0 || selectedIndex >= annotations.length - 1} onClick={() => onStep(1)}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">Next →</button>
      </nav>
    )}
  </>;
}
