import * as THREE from 'three';
import type { DrawPoint, ProjectedMaskData, ScreenPoint } from './types';

export function getCenterOfPoints(points: THREE.Vector3[]) {
  if (points.length === 0) return new THREE.Vector3();
  return points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .divideScalar(points.length);
}

export function vectorToPoint(vector: THREE.Vector3): DrawPoint {
  return { x: vector.x, y: vector.y, z: vector.z };
}

export function getDominantMeshIndex(indices: number[]) {
  const counts = new Map<number, number>();
  indices.forEach((index) => counts.set(index, (counts.get(index) ?? 0) + 1));
  let selected = 0;
  let highest = -1;
  counts.forEach((count, index) => {
    if (count > highest) {
      selected = index;
      highest = count;
    }
  });
  return selected;
}

export function buildProjectedMaskData(
  camera: THREE.PerspectiveCamera,
  markerSize: number,
  screenPoints: ScreenPoint[],
  worldPoints: THREE.Vector3[],
  meshIndex: number,
  mode: 'stroke' | 'fill',
): ProjectedMaskData {
  camera.updateMatrixWorld(true);

  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  const center = getCenterOfPoints(worldPoints);
  const localPoints = worldPoints.map((point) => point.clone().sub(center));
  const rightValues = localPoints.map((point) => point.dot(right));
  const upValues = localPoints.map((point) => point.dot(up));

  const minRight = Math.min(...rightValues);
  const maxRight = Math.max(...rightValues);
  const minUp = Math.min(...upValues);
  const maxUp = Math.max(...upValues);
  const baseWidth = Math.max(maxRight - minRight, markerSize * 2);
  const baseHeight = Math.max(maxUp - minUp, markerSize * 2);
  const padding = mode === 'fill' ? 1.08 : 1.3;
  const width = baseWidth * padding;
  const height = baseHeight * padding;
  const depth = Math.max(width, height) * 0.75;

  const adjustedCenter = center
    .clone()
    .addScaledVector(right, (minRight + maxRight) * 0.5)
    .addScaledVector(up, (minUp + maxUp) * 0.5)
    .addScaledVector(forward, -markerSize * 0.05);

  const xs = screenPoints.map((point) => point.x);
  const ys = screenPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const screenWidth = Math.max(maxX - minX, 0.001);
  const screenHeight = Math.max(maxY - minY, 0.001);
  const maskPadding = mode === 'fill' ? 0.04 : 0.12;

  const maskPoints = screenPoints.map((point) => ({
    x: maskPadding + ((point.x - minX) / screenWidth) * (1 - maskPadding * 2),
    y: maskPadding + ((point.y - minY) / screenHeight) * (1 - maskPadding * 2),
  }));

  const orientation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');

  return {
    meshIndex,
    position: vectorToPoint(adjustedCenter),
    orientation: { x: orientation.x, y: orientation.y, z: orientation.z },
    size: { x: width, y: height, z: depth },
    maskPoints,
    mode,
    brushWidth: mode === 'stroke' ? 0.055 : undefined,
  };
}
