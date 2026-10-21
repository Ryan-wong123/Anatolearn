import { fromDbAnnotation, toAnnotationPayload } from './annotationMapping.ts';
import type { Annotation, AnnotationPayload, AnnotationRecord } from './types';

interface AnnotationRepository {
  getAnnotations: (modelId: number) => Promise<AnnotationRecord[]>;
  updateAnnotation: (id: number, payload: AnnotationPayload) => Promise<AnnotationRecord>;
}

interface AnnotationLoadTarget {
  isActive: () => boolean;
  replace: (annotations: Annotation[]) => void;
  render: (annotation: Annotation, number: number) => void;
  onError: (message: string, error: unknown) => void;
}

// Coordinates plain records only. Rendering and generated geometry stay owned by Viewer.
export async function loadViewerAnnotations(modelId: number, repository: AnnotationRepository, target: AnnotationLoadTarget) {
  try {
    const records = await repository.getAnnotations(modelId);
    if (!target.isActive()) return;
    const annotations = records.map(fromDbAnnotation);
    target.replace(annotations);
    for (const [index, annotation] of annotations.entries()) {
      if (!target.isActive()) return;
      const hadCache = Boolean(annotation.projectedMask?.cachedGeometry?.positions.length);
      target.render(annotation, index + 1);
      if (annotation.id === undefined || hadCache || !annotation.projectedMask?.cachedGeometry?.positions.length) continue;
      try {
        await repository.updateAnnotation(annotation.id, toAnnotationPayload(annotation));
      } catch (error) {
        if (target.isActive()) target.onError(`Failed to save projected geometry cache for annotation ${annotation.id}:`, error);
      }
    }
  } catch (error) {
    if (target.isActive()) target.onError('Failed to load annotations:', error);
  }
}
