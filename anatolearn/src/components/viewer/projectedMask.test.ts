import * as THREE from 'three';
import { createMaskCanvas, createProjectedMaskMesh, disposeProjectedMask, maskContainsUv, simplifyScreenPoints } from './projectedMask';
import type { Annotation, ProjectedMaskData } from './types';

function projectedMask(overrides: Partial<ProjectedMaskData> = {}): ProjectedMaskData {
  return {
    meshIndex: 0, mode: 'fill', maskPoints: [], brushWidth: 0.04,
    position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 1, z: 1 }, ...overrides,
  };
}

describe('projected mask helpers', () => {
  it('keeps separated points and removes dense pointer samples', () => {
    expect(simplifyScreenPoints([{ x: 0, y: 0 }, { x: .001, y: .001 }, { x: .1, y: .1 }]))
      .toEqual([{ x: 0, y: 0 }, { x: .1, y: .1 }]);
    expect(simplifyScreenPoints([])).toEqual([]);
  });

  it('returns a blank canvas for an incomplete mask', () => {
    const canvas = createMaskCanvas(projectedMask({ maskPoints: [{ x: .5, y: .5 }] }));
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(1024);
  });

  it('rebuilds cached geometry and disposes it safely', () => {
    const annotation = {
      id: 1, label: 'cached', annotation_type: 'region_fill', annotation_data: {},
      projectedMask: projectedMask({ cachedGeometry: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] } }),
    } as unknown as Annotation;
    const mesh = createProjectedMaskMesh(new THREE.Mesh(), annotation);
    expect(mesh?.geometry.getAttribute('position').count).toBe(3);
    if (mesh) disposeProjectedMask(mesh);
  });

  it('treats an unavailable canvas context as selectable', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(maskContainsUv(canvas, new THREE.Vector2(-1, 2))).toBe(true);
  });
});
