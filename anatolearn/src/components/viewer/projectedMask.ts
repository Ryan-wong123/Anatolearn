import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';

import type {
  Annotation,
  CachedProjectedGeometry,
  ProjectedMaskData,
  ScreenPoint,
} from './types';

const MASK_SIZE = 1024;

// Set to false to immediately restore the original raycasting path if needed.
const ENABLE_CONSERVATIVE_RAYCAST_PREFILTER = true;

// Set false to compare against the original, unaccelerated raycaster.
const ENABLE_BVH_RAYCAST = true;

type BVHGeometry = THREE.BufferGeometry & { boundsTree?: MeshBVH };
type FirstHitRaycaster = THREE.Raycaster & { firstHitOnly?: boolean };

// BVH construction is expensive, so reuse it for subsequent annotations on
// the same source geometry. WeakMap does not keep disposed GLBs alive by itself.
const sourceBVHCache = new WeakMap<THREE.BufferGeometry, BVHGeometry>();

/**
 * Create a separate raycast-only mesh. Never overwrite sourceMesh.raycast:
 * doing so would disable our conservative proxy eligibility check, and could
 * alter point picking or other viewer operations.
 *
 * The BVH may create/reorder a geometry index. For source geometry without
 * an index we clone first; indexed source geometry uses indirect BVH mode,
 * which preserves the original index order.
 */
function createBVHRaycastTarget(target: THREE.Mesh, isTemporaryProxy: boolean): THREE.Mesh {
  const originalGeometry = target.geometry;
  let geometry: BVHGeometry;

  if (isTemporaryProxy) {
    geometry = originalGeometry as BVHGeometry;
  } else {
    const cached = sourceBVHCache.get(originalGeometry);
    geometry = cached ?? (originalGeometry.index
      ? originalGeometry as BVHGeometry
      : originalGeometry.clone() as BVHGeometry);
  }

  if (!geometry.boundsTree) {
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
  }

  if (!isTemporaryProxy) sourceBVHCache.set(originalGeometry, geometry);

  const accelerated = new THREE.Mesh(geometry, target.material);
  accelerated.matrixAutoUpdate = false;
  accelerated.matrixWorld.copy(target.matrixWorld);
  accelerated.layers.mask = target.layers.mask;
  accelerated.raycast = acceleratedRaycast;
  return accelerated;
}

function canBVHAccelerate(mesh: THREE.Mesh): boolean {
  return !(
    Array.isArray(mesh.material) ||
    mesh.raycast !== THREE.Mesh.prototype.raycast ||
    (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
    (mesh as THREE.InstancedMesh).isInstancedMesh ||
    (mesh.morphTargetInfluences?.length ?? 0) > 0 ||
    mesh.geometry.drawRange.start !== 0 ||
    mesh.geometry.drawRange.count !== Infinity
  );
}


/**
 * Recreates the alpha mask used by a projected annotation.
 *
 * The mask is stored as normalized points rather than as a full PNG. This
 * keeps the actual mask definition relatively small and allows it to be
 * rebuilt whenever the annotation is loaded.
 */
export function createMaskCanvas(
  data: ProjectedMaskData,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  canvas.width = MASK_SIZE;
  canvas.height = MASK_SIZE;

  const context = canvas.getContext('2d');

  if (!context) {
    return canvas;
  }

  context.clearRect(
    0,
    0,
    MASK_SIZE,
    MASK_SIZE,
  );

  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.strokeStyle = '#ffffff';
  context.fillStyle = '#ffffff';

  const points = data.maskPoints;

  if (points.length < 2) {
    return canvas;
  }

  context.beginPath();

  context.moveTo(
    points[0].x * MASK_SIZE,
    points[0].y * MASK_SIZE,
  );

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    context.lineTo(
      points[index].x * MASK_SIZE,
      points[index].y * MASK_SIZE,
    );
  }

  if (data.mode === 'fill') {
    context.closePath();
    context.fill();
  } else {
    context.lineWidth = Math.max(
      2,
      (data.brushWidth ?? 0.035) * MASK_SIZE,
    );

    context.stroke();
  }

  return canvas;
}

/**
 * Converts generated decal geometry into plain arrays that can be stored
 * inside annotation_data JSONB.
 */
function geometryToCache(
  geometry: THREE.BufferGeometry,
): CachedProjectedGeometry {
  const positionAttribute = geometry.getAttribute('position');
  const normalAttribute = geometry.getAttribute('normal');
  const uvAttribute = geometry.getAttribute('uv');

  if (!positionAttribute) {
    throw new Error(
      'Cannot cache projected geometry without a position attribute.',
    );
  }

  return {
    positions: Array.from(
      positionAttribute.array as ArrayLike<number>,
    ),

    normals: normalAttribute
      ? Array.from(
          normalAttribute.array as ArrayLike<number>,
        )
      : undefined,

    uvs: uvAttribute
      ? Array.from(
          uvAttribute.array as ArrayLike<number>,
        )
      : undefined,
  };
}

/**
 * Reconstructs a BufferGeometry directly from the saved cache.
 *
 * This is the fast loading path. It does not create DecalGeometry and does
 * not perform any visibility raycasts.
 */
function geometryFromCache(
  cache: CachedProjectedGeometry,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      cache.positions,
      3,
    ),
  );

  if (cache.normals?.length) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        cache.normals,
        3,
      ),
    );
  } else {
    geometry.computeVertexNormals();
  }

  if (cache.uvs?.length) {
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        cache.uvs,
        2,
      ),
    );
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Reads one component from a BufferAttribute.
 *
 * This avoids relying on BufferAttribute.getComponent(), which is not
 * available in every Three.js version.
 */
function readAttributeComponent(
  attribute: THREE.BufferAttribute,
  vertexIndex: number,
  componentIndex: number,
): number {
  switch (componentIndex) {
    case 0:
      return attribute.getX(vertexIndex);

    case 1:
      return attribute.getY(vertexIndex);

    case 2:
      return attribute.getZ(vertexIndex);

    case 3:
      return attribute.getW(vertexIndex);

    default:
      return 0;
  }
}

/**
 * Copies a chosen set of triangles from a non-indexed BufferGeometry.
 *
 * DecalGeometry creates non-indexed geometry, meaning every three vertices
 * form one independent triangle.
 */
function copySelectedTriangles(
  sourceGeometry: THREE.BufferGeometry,
  selectedTriangleIndices: number[],
): THREE.BufferGeometry {
  const outputGeometry = new THREE.BufferGeometry();

  Object.entries(sourceGeometry.attributes).forEach(
    ([attributeName, sourceAttribute]) => {
      const attribute =
        sourceAttribute as THREE.BufferAttribute;

      const values: number[] = [];

      selectedTriangleIndices.forEach(
        (triangleIndex) => {
          const firstVertexIndex =
            triangleIndex * 3;

          for (
            let vertexOffset = 0;
            vertexOffset < 3;
            vertexOffset += 1
          ) {
            const vertexIndex =
              firstVertexIndex + vertexOffset;

            for (
              let componentIndex = 0;
              componentIndex < attribute.itemSize;
              componentIndex += 1
            ) {
              values.push(
                readAttributeComponent(
                  attribute,
                  vertexIndex,
                  componentIndex,
                ),
              );
            }
          }
        },
      );

      outputGeometry.setAttribute(
        attributeName,
        new THREE.Float32BufferAttribute(
          values,
          attribute.itemSize,
          attribute.normalized,
        ),
      );
    },
  );

  if (outputGeometry.getAttribute('position')) {
    outputGeometry.computeBoundingBox();
    outputGeometry.computeBoundingSphere();
  }

  return outputGeometry;
}

/**
 * Builds a temporary, conservatively clipped raycast mesh for ONE projector.
 *
 * DecalGeometry already restricts its output to the projector's X/Y bounds.
 * A ray cast along the projector's Z axis therefore cannot hit a source
 * triangle whose projected X/Y bounding box is entirely outside that area.
 *
 * We retain ALL potentially intersecting source triangles and let Three.js
 * perform the original ray intersections and first-hit ordering unchanged.
 * No approximate intersection/visibility decision is introduced here.
 *
 * Complex meshes fall back to the original raycasting path. The proxy is
 * discarded after filtering; it never changes source geometry or materials.
 */
function createProjectorRaycastProxy(
  sourceMesh: THREE.Mesh,
  projectorPosition: THREE.Vector3,
  projectorOrientation: THREE.Euler,
  projectorSize: THREE.Vector3,
): THREE.Mesh | null {
  const sourceGeometry = sourceMesh.geometry;
  const position = sourceGeometry.getAttribute('position');
  const index = sourceGeometry.getIndex();
  const vertexCount = index?.count ?? position?.count ?? 0;
  const triangleCount = Math.floor(vertexCount / 3);

  // Building a proxy costs more than it saves for small or complex meshes.
  // Grouped multi-material, deformed and partial-draw geometries are left on
  // the original code path to preserve their material/animation semantics.
  if (
    !position || triangleCount < 10_000 ||
    Array.isArray(sourceMesh.material) ||
    sourceMesh.raycast !== THREE.Mesh.prototype.raycast ||
    (sourceMesh as THREE.SkinnedMesh).isSkinnedMesh ||
    (sourceMesh as THREE.InstancedMesh).isInstancedMesh ||
    (sourceMesh.morphTargetInfluences?.length ?? 0) > 0 ||
    sourceGeometry.drawRange.start !== 0 ||
    sourceGeometry.drawRange.count !== Infinity
  ) return null;

  // Source local space -> projector local space; its rays are parallel to -Z.
  const toProjector = new THREE.Matrix4()
    .makeRotationFromEuler(projectorOrientation)
    .invert()
    .multiply(new THREE.Matrix4().makeTranslation(
      -projectorPosition.x, -projectorPosition.y, -projectorPosition.z,
    ))
    .multiply(sourceMesh.matrixWorld);

  // Expand, never shrink, the projector rectangle. False positives are fine:
  // false negatives would change which surface the original raycaster sees.
  const padding = Math.max(projectorSize.x, projectorSize.y) * 0.001 + 0.000001;
  const minX = -projectorSize.x * 0.5 - padding;
  const maxX = projectorSize.x * 0.5 + padding;
  const minY = -projectorSize.y * 0.5 - padding;
  const maxY = projectorSize.y * 0.5 + padding;

  const selected: number[] = [];
  const projected = new THREE.Vector3();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    let triMinX = Infinity, triMaxX = -Infinity;
    let triMinY = Infinity, triMaxY = -Infinity;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      projected.set(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex))
        .applyMatrix4(toProjector);
      triMinX = Math.min(triMinX, projected.x);
      triMaxX = Math.max(triMaxX, projected.x);
      triMinY = Math.min(triMinY, projected.y);
      triMaxY = Math.max(triMaxY, projected.y);
    }

    if (triMaxX >= minX && triMinX <= maxX && triMaxY >= minY && triMinY <= maxY) {
      selected.push(triangle);
    }
  }

  // The conservative prefilter must never make an annotation disappear.
  // If the scan isn't meaningfully reduced, keep the original raycast path.
  if (!selected.length || selected.length > triangleCount * 0.6) return null;

  const points = new Float32Array(selected.length * 9);
  let dest = 0;
  for (const triangle of selected) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      points[dest++] = position.getX(vertexIndex);
      points[dest++] = position.getY(vertexIndex);
      points[dest++] = position.getZ(vertexIndex);
    }
  }

  const reduced = new THREE.BufferGeometry();
  reduced.setAttribute('position', new THREE.BufferAttribute(points, 3));
  reduced.computeBoundingSphere();

  // Keep the same world transform and the exact original material, including
  // front/back/double-sided raycast behaviour. No mesh is added to the scene.
  const proxy = new THREE.Mesh(reduced, sourceMesh.material);
  proxy.matrixAutoUpdate = false;
  proxy.matrixWorld.copy(sourceMesh.matrixWorld);
  proxy.layers.mask = sourceMesh.layers.mask;
  return proxy;
}

/**
 * Removes decal triangles lying behind the first visible source-model
 * surface from the original projection direction.
 *
 * This is expensive, but it should only execute once when a projected
 * annotation is initially generated. The filtered result is then cached.
 */
function filterToFirstVisibleSurface(
  decalGeometry: THREE.BufferGeometry,
  sourceMesh: THREE.Mesh,
  projectorPosition: THREE.Vector3,
  projectorOrientation: THREE.Euler,
  projectorSize: THREE.Vector3,
  usePrefilter = true,
): THREE.BufferGeometry {
  const positionAttribute =
    decalGeometry.getAttribute('position');

  if (
    !positionAttribute ||
    positionAttribute.count < 3
  ) {
    return decalGeometry;
  }

  const projectorQuaternion =
    new THREE.Quaternion().setFromEuler(
      projectorOrientation,
    );

  const inverseProjectorQuaternion =
    projectorQuaternion.clone().invert();

  /**
   * Three.js cameras and decal projectors face along local negative Z.
   */
  const projectorDirection =
    new THREE.Vector3(0, 0, -1)
      .applyQuaternion(projectorQuaternion)
      .normalize();

  const largestProjectorDimension = Math.max(
    projectorSize.x,
    projectorSize.y,
    projectorSize.z,
  );

  /**
   * Determines how close a decal triangle must be to the first model hit.
   */
  const surfaceTolerance = Math.max(
    largestProjectorDimension * 0.0125,
    0.0001,
  );

  /**
   * Moves the ray origin slightly in front of the projector.
   */
  const originMargin = Math.max(
    largestProjectorDimension * 0.02,
    0.0001,
  );

  const raycaster = new THREE.Raycaster();

  const selectedTriangleIndices: number[] = [];

  const vertexA = new THREE.Vector3();
  const vertexB = new THREE.Vector3();
  const vertexC = new THREE.Vector3();

  const edgeAB = new THREE.Vector3();
  const edgeAC = new THREE.Vector3();

  const triangleCenter = new THREE.Vector3();
  const triangleNormal = new THREE.Vector3();

  const projectorLocalCenter = new THREE.Vector3();
  const projectorLocalOrigin = new THREE.Vector3();

  const rayOrigin = new THREE.Vector3();

  const triangleCount = Math.floor(
    positionAttribute.count / 3,
  );

  sourceMesh.updateWorldMatrix(
    true,
    false,
  );

  let proxy: THREE.Mesh | null = null;
  if (usePrefilter && ENABLE_CONSERVATIVE_RAYCAST_PREFILTER) {
    try {
      proxy = createProjectorRaycastProxy(
        sourceMesh, projectorPosition, projectorOrientation, projectorSize,
      );
    } catch (error) {
      // An unusual scan must never be prevented from rendering by the fast path.
      console.warn('Projection raycast prefilter failed; using original mesh.', error);
    }
  }
  const raycastTarget = proxy ?? sourceMesh;
  let activeRaycastTarget: THREE.Mesh = raycastTarget;
  let usingBVH = false;

  if (ENABLE_BVH_RAYCAST && (proxy !== null || canBVHAccelerate(sourceMesh))) {
    try {
      const bvhStart = performance.now();
      activeRaycastTarget = createBVHRaycastTarget(raycastTarget, proxy !== null);
      (raycaster as FirstHitRaycaster).firstHitOnly = true;
      usingBVH = true;
      console.info(`[projection] BVH ready in ${(performance.now() - bvhStart).toFixed(1)} ms`);
    } catch (error) {
      // A failed acceleration must not prevent users from annotating.
      // The original, unmodified target remains available.
      console.warn('[projection] BVH setup failed; falling back to Three.js raycasting.', error);
      activeRaycastTarget = raycastTarget;
      (raycaster as FirstHitRaycaster).firstHitOnly = false;
    }
  }

  try {
  for (
    let triangleIndex = 0;
    triangleIndex < triangleCount;
    triangleIndex += 1
  ) {
    const firstVertexIndex =
      triangleIndex * 3;

    vertexA.fromBufferAttribute(
      positionAttribute as THREE.BufferAttribute,
      firstVertexIndex,
    );

    vertexB.fromBufferAttribute(
      positionAttribute as THREE.BufferAttribute,
      firstVertexIndex + 1,
    );

    vertexC.fromBufferAttribute(
      positionAttribute as THREE.BufferAttribute,
      firstVertexIndex + 2,
    );

    triangleCenter
      .copy(vertexA)
      .add(vertexB)
      .add(vertexC)
      .multiplyScalar(1 / 3);

    edgeAB.subVectors(
      vertexB,
      vertexA,
    );

    edgeAC.subVectors(
      vertexC,
      vertexA,
    );

    triangleNormal
      .crossVectors(
        edgeAB,
        edgeAC,
      )
      .normalize();

    /**
     * Reject strongly backward-facing surfaces.
     *
     * A slight allowance is kept because curved surfaces may be close to
     * perpendicular to the projector.
     */
    const facingAmount =
      triangleNormal.dot(
        projectorDirection,
      );

    if (facingAmount > 0.2) {
      continue;
    }

    /**
     * Convert the triangle centre into the decal projector's local space.
     */
    projectorLocalCenter
      .copy(triangleCenter)
      .sub(projectorPosition)
      .applyQuaternion(
        inverseProjectorQuaternion,
      );

    /**
     * Keep the triangle's local X/Y but begin the ray at the front of the
     * projector volume.
     */
    projectorLocalOrigin.set(
      projectorLocalCenter.x,
      projectorLocalCenter.y,
      projectorSize.z * 0.5 + originMargin,
    );

    rayOrigin
      .copy(projectorLocalOrigin)
      .applyQuaternion(
        projectorQuaternion,
      )
      .add(projectorPosition);

    raycaster.set(
      rayOrigin,
      projectorDirection,
    );

    raycaster.near = 0;

    raycaster.far =
      projectorSize.z +
      originMargin * 2;

    const intersections =
      raycaster.intersectObject(
        activeRaycastTarget,
        false,
      );

    if (intersections.length === 0) {
      continue;
    }

    const firstSurfaceHit =
      intersections[0];

    const distanceFromFirstSurface =
      firstSurfaceHit.point.distanceTo(
        triangleCenter,
      );

    if (
      distanceFromFirstSurface <=
      surfaceTolerance
    ) {
      selectedTriangleIndices.push(
        triangleIndex,
      );
    }
  }
  } finally {
    // Only the temporary proxy is released. Source mesh geometry/materials
    // belong to the caller and must not be mutated or disposed here.
    if (usingBVH && proxy) {
      (proxy.geometry as BVHGeometry).boundsTree = undefined;
    }
    proxy?.geometry.dispose();
  }

  /**
   * Avoid making the entire annotation disappear if an unusual mesh causes
   * all triangles to be rejected.
   */
  if (
    selectedTriangleIndices.length === 0
  ) {
    // If the accelerated path found no visible surface, retry the original
    // algorithm before applying its historical unfiltered fallback.
    if (proxy) {
      return filterToFirstVisibleSurface(
        decalGeometry, sourceMesh, projectorPosition,
        projectorOrientation, projectorSize, false,
      );
    }
    console.warn(
      'Projected-mask filtering removed every triangle. Falling back to the unfiltered decal.',
    );

    return decalGeometry;
  }

  const filteredGeometry =
    copySelectedTriangles(
      decalGeometry,
      selectedTriangleIndices,
    );

  decalGeometry.dispose();

  return filteredGeometry;
}

/**
 * Builds the projected annotation mesh.
 *
 * Fast path:
 * - cachedGeometry exists
 * - reconstruct the BufferGeometry immediately
 *
 * Slow path:
 * - create DecalGeometry
 * - filter hidden/deeper surfaces
 * - store the filtered geometry in projectedMask.cachedGeometry
 */
export function createProjectedMaskMesh(
  sourceMesh: THREE.Mesh,
  annotation: Annotation,
): THREE.Mesh | null {
  const data =
    annotation.projectedMask;

  if (!data) {
    return null;
  }

  sourceMesh.updateWorldMatrix(
    true,
    false,
  );

  let geometry: THREE.BufferGeometry;

  if (
    data.cachedGeometry?.positions.length
  ) {
    /**
     * Fast path used during normal viewer loading.
     */
    geometry = geometryFromCache(
      data.cachedGeometry,
    );
  } else {
    /**
     * Slow path used once when creating an annotation, or once when loading
     * an older annotation without cached geometry.
     */
    const projectorPosition =
      new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );

    const projectorOrientation =
      new THREE.Euler(
        data.orientation.x,
        data.orientation.y,
        data.orientation.z,
        'XYZ',
      );

    const projectorSize =
      new THREE.Vector3(
        data.size.x,
        data.size.y,
        data.size.z,
      );

    // Baseline timing: instrumentation only, no geometry behaviour changes.
    const projectionStart = performance.now();
    geometry = new DecalGeometry(
      sourceMesh,
      projectorPosition,
      projectorOrientation,
      projectorSize,
    );
    const decalEnd = performance.now();

    const generatedPositionAttribute =
      geometry.getAttribute('position');

    if (
      !generatedPositionAttribute ||
      generatedPositionAttribute.count === 0
    ) {
      geometry.dispose();
      return null;
    }

    geometry =
      filterToFirstVisibleSurface(
        geometry,
        sourceMesh,
        projectorPosition,
        projectorOrientation,
        projectorSize,
      );
    const projectionEnd = performance.now();

    console.table({
      'Decal generation (ms)': (decalEnd - projectionStart).toFixed(2),
      'Visibility filtering (ms)': (projectionEnd - decalEnd).toFixed(2),
      'Total projection (ms)': (projectionEnd - projectionStart).toFixed(2),
      'Total projection (s)': ((projectionEnd - projectionStart) / 1000).toFixed(2),
    });

    const filteredPositionAttribute =
      geometry.getAttribute('position');

    if (
      !filteredPositionAttribute ||
      filteredPositionAttribute.count === 0
    ) {
      geometry.dispose();
      return null;
    }

    /**
     * Mutate the annotation's projectedMask data so Viewer.tsx includes this
     * cache when it creates the API payload.
     */
    data.cachedGeometry =
      geometryToCache(
        geometry,
      );
  }

  const canvas =
    createMaskCanvas(data);

  const alphaMap =
    new THREE.CanvasTexture(
      canvas,
    );

  alphaMap.colorSpace =
    THREE.NoColorSpace;

  alphaMap.needsUpdate = true;

  const material =
    new THREE.MeshBasicMaterial({
      color:
        annotation.color ??
        (data.mode === 'fill'
          ? '#22d3ee'
          : '#facc15'),

      alphaMap,

      transparent: true,

      opacity:
        annotation.opacity ??
        (data.mode === 'fill'
          ? 0.24
          : 0.32),

      depthWrite: false,

      polygonOffset: true,

      polygonOffsetFactor: -4,

      side: THREE.FrontSide,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.renderOrder = 20;

  mesh.userData.annotation =
    annotation;

  mesh.userData.maskCanvas =
    canvas;

  mesh.userData.isProjectedMask =
    true;

  return mesh;
}

/**
 * Disposes the projected mesh and its alpha texture.
 */
export function disposeProjectedMask(
  mesh: THREE.Mesh,
) {
  mesh.removeFromParent();

  mesh.geometry.dispose();

  const materials =
    Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

  materials.forEach(
    (material) => {
      if (
        material instanceof
        THREE.MeshBasicMaterial
      ) {
        material.alphaMap?.dispose();
      }

      material.dispose();
    },
  );
}

/**
 * Determines whether a clicked decal UV falls inside the annotation mask.
 */
export function maskContainsUv(
  canvas: HTMLCanvasElement,
  uv: THREE.Vector2,
): boolean {
  const context =
    canvas.getContext(
      '2d',
      {
        willReadFrequently: true,
      },
    );

  if (!context) {
    return true;
  }

  const x = Math.min(
    canvas.width - 1,
    Math.max(
      0,
      Math.floor(
        uv.x * canvas.width,
      ),
    ),
  );

  const y = Math.min(
    canvas.height - 1,
    Math.max(
      0,
      Math.floor(
        (1 - uv.y) * canvas.height,
      ),
    ),
  );

  return (
    context.getImageData(
      x,
      y,
      1,
      1,
    ).data[3] > 20
  );
}

/**
 * Reduces excessive pointer samples while retaining the freehand shape.
 */
export function simplifyScreenPoints(
  points: ScreenPoint[],
  minimumDistance = 0.004,
): ScreenPoint[] {
  const simplified: ScreenPoint[] =
    [];

  points.forEach((point) => {
    const previous =
      simplified.at(-1);

    if (
      !previous ||
      Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
      ) >= minimumDistance
    ) {
      simplified.push(point);
    }
  });

  return simplified;
}