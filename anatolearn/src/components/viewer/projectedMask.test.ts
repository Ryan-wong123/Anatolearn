import { createMaskCanvas } from './projectedMask';
import { expect, test } from 'vitest';

const base = { meshIndex: 0, position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } };

test('returns a 1024px canvas when the 2D context is unavailable', () => {
  const canvas = createMaskCanvas({ ...base, mode: 'fill', maskPoints: [] });
  expect(canvas.width).toBe(1024);
  expect(canvas.height).toBe(1024);
});

test('ignores a single-point projected mask safely', () => {
  const canvas = createMaskCanvas({ ...base, mode: 'stroke', maskPoints: [{ x: 0.5, y: 0.5 }] });
  expect(canvas).toBeInstanceOf(HTMLCanvasElement);
});
