import type { Annotation, AnnotationKind } from './types';

export function toDbAnnotationType(
  kind: AnnotationKind,
): 'point' | 'highlight' | 'region_fill' {
  if (kind === 'point') return 'point';
  if (kind === 'draw' || kind === 'projectedDraw') return 'highlight';
  return 'region_fill';
}

export function fromDbAnnotation(row: any): Annotation {
  const data = row.annotation_data ?? {};
  let kind: AnnotationKind;

  if (row.annotation_type === 'point') {
    kind = 'point';
  } else if (data.projectedMask) {
    kind = row.annotation_type === 'highlight' ? 'projectedDraw' : 'projectedRegion';
  } else if (row.annotation_type === 'highlight') {
    kind = 'draw';
  } else {
    kind = 'region';
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description || '',
    color:
      row.color ||
      (kind === 'projectedRegion'
        ? '#22d3ee'
        : kind === 'projectedDraw'
          ? '#facc15'
          : undefined),
    opacity: data.opacity,
    kind,
    position: data.position,
    drawPoints: data.drawPoints,
    regionPlane: data.regionPlane,
    regionTriangles: data.regionTriangles,
    projectedMask: data.projectedMask,
    view: data.view,
  };
}
