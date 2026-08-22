import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMaskCanvas, createProjectedMaskMesh } from './projectedMask';
import type { Annotation, ProjectedMaskData } from './types';

const projectedMask: ProjectedMaskData = {
  meshIndex: 0, mode: 'fill', maskPoints: [],
  position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
};

describe('projected masks', () => {
  it('returns a correctly sized canvas for an empty mask', () => {
    const canvas = createMaskCanvas(projectedMask);
    expect([canvas.width, canvas.height]).toEqual([1024, 1024]);
  });

  it('returns null when an annotation has no projected data', () => {
    expect(createProjectedMaskMesh(new THREE.Mesh(), { label: '', description: '', kind: 'point', position: { x: 0, y: 0, z: 0 }, color: '#fff' })).toBeNull();
  });

  it('recreates cached geometry even when normals and UVs are absent', () => {
    const annotation = {
      color: '#fff',
      projectedMask: { ...projectedMask, cachedGeometry: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
    } as unknown as Annotation;
    const mesh = createProjectedMaskMesh(new THREE.Mesh(), annotation);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh?.geometry.getAttribute('normal')).toBeDefined();
  });
});
