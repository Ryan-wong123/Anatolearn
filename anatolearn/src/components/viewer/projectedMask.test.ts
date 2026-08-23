import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { maskContainsUv, simplifyScreenPoints } from './projectedMask';

function maskCanvas(alpha: number) {
  const getImageData = () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) });
  return { width: 10, height: 10, getContext: () => ({ getImageData }) } as unknown as HTMLCanvasElement;
}

describe('projected mask geometry helpers', () => {
  it('detects opaque mask pixels and rejects transparent pixels', () => {
    expect(maskContainsUv(maskCanvas(255), new THREE.Vector2(0.5, 0.5))).toBe(true);
    expect(maskContainsUv(maskCanvas(0), new THREE.Vector2(0.5, 0.5))).toBe(false);
  });

  it('handles empty and short paths deterministically', () => {
    expect(simplifyScreenPoints([], 2)).toEqual([]);
    expect(simplifyScreenPoints([{ x: 1, y: 1 }], 2)).toEqual([{ x: 1, y: 1 }]);
  });

  it('removes redundant points while preserving endpoints', () => {
    const points = [{ x: 0, y: 0 }, { x: 0.5, y: 0.01 }, { x: 1, y: 0 }];
    const simplified = simplifyScreenPoints(points, 0.6);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified.at(-1)).toEqual(points.at(-1));
  });
});
