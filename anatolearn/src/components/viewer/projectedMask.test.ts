import { createMaskCanvas } from './projectedMask';
import { expect, it, vi } from 'vitest';

function contextMock() {
  return {
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(), lineCap: '', lineJoin: '',
    strokeStyle: '', fillStyle: '', lineWidth: 0,
  };
}

it('does not draw a mask with fewer than two points', () => {
  const context = contextMock();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  createMaskCanvas({ mode: 'draw', maskPoints: [{ x: 0.5, y: 0.5 }] } as never);
  expect(context.beginPath).not.toHaveBeenCalled();
});

it.each([['fill', 'fill'], ['draw', 'stroke']] as const)('renders %s masks', (mode: 'fill' | 'draw', method: 'fill' | 'stroke') => {
  const context = contextMock();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  createMaskCanvas({ mode, maskPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } as never);
  expect(context[method]).toHaveBeenCalledOnce();
});
