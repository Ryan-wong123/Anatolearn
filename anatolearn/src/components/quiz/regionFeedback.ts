import * as THREE from 'three';
import { createProjectedMaskMesh } from '../viewer/projectedMask';
import { fromDbAnnotation } from '../viewer/annotationMapping';
import type { AnnotationRecord, DrawPoint } from '../../types/anatomy';
import type { ProjectedMaskData, ScreenPoint } from '../viewer/types';

/** A frozen teacher reference returned ONLY after the quiz attempt is submitted. */
export type RegionReview = {
  model_id: number;
  reference_annotation_id: number | null;
  reference_mask: ProjectedMaskData;
  details?: { iou?: number; coverage?: number; precision?: number };
};

const SIZE = 512;

/** Same world-to-projector XYZ Euler transform as backend threeDGrading.toProjector(). */
function projectPoint(p: DrawPoint, mask: ProjectedMaskData): ScreenPoint {
  const offset = new THREE.Vector3(p.x - mask.position.x, p.y - mask.position.y, p.z - mask.position.z);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    mask.orientation.x, mask.orientation.y, mask.orientation.z, 'XYZ',
  ));
  offset.applyQuaternion(rotation.invert());
  return { x: 0.5 + offset.x / mask.size.x, y: 0.5 - offset.y / mask.size.y };
}

function polygonPixels(points: ScreenPoint[]): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx || points.length < 3) return new Uint8ClampedArray(SIZE * SIZE * 4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x * SIZE, points[0].y * SIZE);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * SIZE, points[i].y * SIZE);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

/**
 * Pixel categories use exactly the polygons the server compares:
 * overlap = green, teacher-only (missed) = amber, student-only = red.
 * Rendering is confined to the teacher's decal projector footprint.
 */
export function createRegionFeedbackCanvas(mask: ProjectedMaskData, studentPoints: DrawPoint[]): HTMLCanvasElement {
  const truth = polygonPixels(mask.maskPoints);
  const student = polygonPixels(studentPoints.map(p => projectPoint(p, mask)));
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const image = context.createImageData(SIZE, SIZE);
  for (let i = 0; i < truth.length; i += 4) {
    const correct = truth[i + 3] > 127;
    const shaded = student[i + 3] > 127;
    if (!correct && !shaded) continue;
    if (correct && shaded) {
      image.data[i] = 34; image.data[i + 1] = 197; image.data[i + 2] = 94;
    } else if (correct) {
      image.data[i] = 245; image.data[i + 1] = 158; image.data[i + 2] = 11;
    } else {
      image.data[i] = 239; image.data[i + 1] = 68; image.data[i + 2] = 68;
    }
    image.data[i + 3] = 205;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function sameProjector(a: ProjectedMaskData, b: ProjectedMaskData): boolean {
  return a.meshIndex === b.meshIndex &&
    JSON.stringify([a.position, a.orientation, a.size]) === JSON.stringify([b.position, b.orientation, b.size]);
}

/** Overlay is an actual decal on the model, not a floating screen-space image. */
export function createRegionFeedbackMesh(
  modelMeshes: THREE.Mesh[], annotations: AnnotationRecord[], review: RegionReview,
  studentPoints: DrawPoint[],
): THREE.Mesh | null {
  const mask = review.reference_mask;
  const sourceMesh = modelMeshes[mask.meshIndex];
  if (!sourceMesh || mask.mode !== 'fill') return null;
  const saved = annotations.find(a => a.id === review.reference_annotation_id);
  const parsed = saved ? fromDbAnnotation(saved) : null;
  const cachedGeometry = parsed?.projectedMask && sameProjector(parsed.projectedMask, mask)
    ? parsed.projectedMask.cachedGeometry : undefined;
  const annotation = {
    kind: 'projectedRegion' as const,
    label: parsed?.label ?? '',
    description: parsed?.description ?? '',
    position: mask.position,
    projectedMask: { ...mask, cachedGeometry },
    color: '#ffffff',
    opacity: 1,
  };
  const mesh = createProjectedMaskMesh(sourceMesh, annotation);
  if (!mesh) return null;
  const oldMaterial = mesh.material;
  // Replace the annotation's solid colour+alphaMap with a multicolour RGBA map.
  if (oldMaterial instanceof THREE.MeshBasicMaterial) oldMaterial.alphaMap?.dispose();
  if (Array.isArray(oldMaterial)) oldMaterial.forEach(material => material.dispose());
  else oldMaterial.dispose();
  const texture = new THREE.CanvasTexture(createRegionFeedbackCanvas(mask, studentPoints));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.88,
    depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -5,
  });
  mesh.material = material;
  mesh.renderOrder = 40;
  return mesh;
}
