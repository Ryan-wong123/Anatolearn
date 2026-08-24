import { describe, expect, it, vi } from 'vitest';
import { maskContainsUv, simplifyScreenPoints } from './projectedMask';

describe('projected mask edge cases', () => {
  it('handles empty and single-point paths', () => {
    expect(simplifyScreenPoints([], 2)).toEqual([]);
    expect(simplifyScreenPoints([{ x: 1, y: 2 }], 2)).toEqual([{ x: 1, y: 2 }]);
  });

  it('uses clamped, vertically flipped UV coordinates for hit testing', () => {
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }));
    const canvas = { width: 100, height: 100, getContext: vi.fn(() => ({ getImageData })) } as unknown as HTMLCanvasElement;
    expect(maskContainsUv(canvas, { x: 0.5, y: 0.25 } as never)).toBe(true);
    expect(getImageData).toHaveBeenCalledWith(50, 75, 1, 1);
  });
});
