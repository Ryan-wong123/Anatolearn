import type { Annotation, AnnotationDraft, AnnotationKind, AnnotationPayload, AnnotationRecord, ProjectedMaskData } from './types';

export function toDbAnnotationType(
  kind: AnnotationKind,
): 'point' | 'highlight' | 'region_fill' {
  if (kind === 'point') return 'point';
  if (kind === 'draw' || kind === 'projectedDraw') return 'highlight';
  return 'region_fill';
}

export function fromDbAnnotation(row: AnnotationRecord): Annotation {
  const data = row.annotation_data;
  let kind: AnnotationKind;

  if (row.annotation_type === 'point') {
    kind = 'point';
  } else if (data?.projectedMask) {
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
    opacity: data?.opacity,
    kind,
    position: data?.position ?? { x: 0, y: 0, z: 0 },
    drawPoints: data?.drawPoints,
    regionPlane: data?.regionPlane,
    regionTriangles: data?.regionTriangles,
    projectedMask: data?.projectedMask,
    view: data?.view,
  };
}

export function toAnnotationPayload(annotation: Annotation): AnnotationPayload {
  return {
    annotation_type: toDbAnnotationType(annotation.kind),
    label: annotation.label,
    description: annotation.description,
    color: annotation.color ?? null,
    annotation_data: {
      position: annotation.position,
      drawPoints: annotation.drawPoints,
      regionPlane: annotation.regionPlane,
      regionTriangles: annotation.regionTriangles,
      projectedMask: annotation.projectedMask,
      view: annotation.view,
      opacity: annotation.opacity,
    },
  };
}

export function applyAnnotationDraft(annotation: Annotation, draft: AnnotationDraft): Annotation {
  return {
    ...annotation,
    label: draft.label.trim(),
    description: draft.description.trim(),
    color: annotation.kind === 'projectedRegion' ? draft.color : annotation.color,
    opacity: annotation.kind === 'projectedRegion' || annotation.kind === 'projectedDraw'
      ? draft.opacity : annotation.opacity,
  };
}

export function isAnnotationActive(annotation: Annotation | undefined, selected: Annotation | null, hovered: Annotation | null): boolean {
  return Boolean(
    (selected && annotation?.id === selected.id) ||
    (hovered && annotation?.id === hovered.id)
  );
}

export function createProjectedAnnotation(projectedMask: ProjectedMaskData, view: Annotation['view']): Annotation {
  const filled = projectedMask.mode === 'fill';
  return {
    label: '', description: '',
    color: filled ? '#22d3ee' : '#facc15', opacity: filled ? 0.24 : 0.32,
    kind: filled ? 'projectedRegion' : 'projectedDraw',
    position: projectedMask.position, projectedMask, view,
  };
}
