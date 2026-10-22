import type { Annotation, DrawPoint } from './types';

export function repositionAnnotation(original: Annotation, position: DrawPoint, meshIndex: number, view: Annotation['view']): Annotation {
  const delta = { x: position.x-original.position.x, y: position.y-original.position.y, z: position.z-original.position.z };
  const translate = (point: DrawPoint) => ({ x: point.x+delta.x, y: point.y+delta.y, z: point.z+delta.z });
  return {
    ...original, position: { ...position }, view,
    ...(original.drawPoints ? { drawPoints: original.drawPoints.map(translate) } : {}),
    ...(original.regionTriangles ? { regionTriangles: original.regionTriangles.map(translate) } : {}),
    ...(original.projectedMask ? { projectedMask: {
      ...original.projectedMask, position: translate(original.projectedMask.position),
      meshIndex, cachedGeometry: undefined,
    } } : {}),
  };
}
