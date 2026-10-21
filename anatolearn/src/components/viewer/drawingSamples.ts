import type { DrawPoint, ScreenPoint } from './types';

export function normalizeDrawingPoint(pointer: { clientX: number; clientY: number }, rect: { left: number; top: number; width: number; height: number }): ScreenPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: (pointer.clientX - rect.left) / rect.width, y: (pointer.clientY - rect.top) / rect.height };
}

export function createDrawingSamples() {
  let screenPoints: ScreenPoint[] = [];
  let worldPoints: DrawPoint[] = [];
  let meshIndices: number[] = [];
  function accepts(point: ScreenPoint) {
    const previous = screenPoints.at(-1);
    return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.003;
  }
  return {
    accepts,
    reset() { screenPoints = []; worldPoints = []; meshIndices = []; },
    append(screen: ScreenPoint, world: DrawPoint, meshIndex: number) {
      if (!accepts(screen)) return false;
      screenPoints.push({ ...screen });
      worldPoints.push({ ...world });
      meshIndices.push(meshIndex);
      return true;
    },
    snapshot: () => ({
      screenPoints: screenPoints.map((point) => ({ ...point })),
      worldPoints: worldPoints.map((point) => ({ ...point })),
      meshIndices: [...meshIndices],
    }),
  };
}


export function hasRegionArea(points: ScreenPoint[]) {
  if (points.length < 3) return false;
  const twiceArea = points.reduce((sum, point, index) => {
    const next = points[(index+1) % points.length];
    return sum + point.x*next.y - next.x*point.y;
  }, 0);
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const boundsArea = (Math.max(...xs)-Math.min(...xs)) * (Math.max(...ys)-Math.min(...ys));
  // Reject pointer jitter around a straight stroke as well as zero-area polygons.
  return Math.abs(twiceArea) > 0.00002 && Math.abs(twiceArea) > boundsArea * 0.1;
}
