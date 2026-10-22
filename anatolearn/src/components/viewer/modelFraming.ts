// Numeric framing policy only; camera and model resources remain owned by Viewer.
export function getModelFraming(radius: number, aspect: number, verticalFov: number) {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfVertical = (verticalFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * safeAspect);
  const distance = safeRadius / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.1;
  return {
    distance,
    near: Math.max(safeRadius / 1000, 0.000001),
    far: Math.max(safeRadius * 100, distance + safeRadius * 10, 10),
    minDistance: safeRadius * 0.03,
    maxDistance: Math.max(safeRadius * 20, distance * 2),
  };
}
