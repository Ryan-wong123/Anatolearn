import type { Annotation, DrawPoint } from './types';

type BasicVisual = {
  position: DrawPoint;
  material: { color: number; transparent?: boolean; opacity?: number; depthWrite?: boolean };
} & ({ shape: 'sphere'; radius: number; segments: number } | { shape: 'triangles'; vertices: number[] });

/** Plain rendering descriptions only; Viewer owns every geometry, material and mesh. */
export function getBasicAnnotationVisuals(annotation: Annotation, markerSize: number): BasicVisual[] {
  if (annotation.kind === 'point') return [{
    shape: 'sphere', radius: markerSize, segments: 24,
    position: annotation.position, material: { color: 0xff1a00 },
  }];
  const material = { transparent: true, opacity: 0.3, depthWrite: false };
  if (annotation.kind === 'draw') return (annotation.drawPoints ?? []).map((position) => ({
    shape: 'sphere', radius: markerSize * 0.22, segments: 8, position,
    material: { ...material, color: 0xffcc00 },
  }));
  if (annotation.kind === 'region' && annotation.regionTriangles) return [{
    shape: 'triangles', position: { x: 0, y: 0, z: 0 },
    vertices: annotation.regionTriangles.flatMap(({ x, y, z }) => [x, y, z]),
    material: { ...material, color: 0x38bdf8 },
  }];
  return [];
}
