import { describe, expect, it } from 'vitest';
import { simplifyScreenPoints } from './projectedMask';

describe('simplifyScreenPoints', () => {
  it('drops nearby samples while retaining the shape', () => {
    expect(simplifyScreenPoints([{ x: 0, y: 0 }, { x: .001, y: .001 }, { x: .2, y: .2 }], .01)).toEqual([{ x: 0, y: 0 }, { x: .2, y: .2 }]);
  });
});
