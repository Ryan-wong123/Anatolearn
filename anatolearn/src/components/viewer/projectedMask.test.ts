import { afterEach, expect, it, vi } from 'vitest';
import { createMaskCanvas } from './projectedMask';

const context = {
  clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(), lineCap: '', lineJoin: '',
  strokeStyle: '', fillStyle: '', lineWidth: 0,
};

afterEach(() => vi.clearAllMocks());

it('leaves masks with fewer than two points empty', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  createMaskCanvas({ meshIndex: 0, position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, maskPoints: [{ x: 0.5, y: 0.5 }], mode: 'fill' });
  expect(context.beginPath).not.toHaveBeenCalled();
});

it('closes filled masks and applies a minimum stroke width', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const base = { meshIndex: 0, position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, maskPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
  createMaskCanvas({ ...base, mode: 'fill' });
  expect(context.closePath).toHaveBeenCalled();
  expect(context.fill).toHaveBeenCalled();
  createMaskCanvas({ ...base, mode: 'stroke', brushWidth: 0 });
  expect(context.lineWidth).toBe(2);
  expect(context.stroke).toHaveBeenCalled();
});
