export type AnnotationKind =
  | 'point'
  | 'draw'
  | 'region'
  | 'projectedDraw'
  | 'projectedRegion';

export interface DrawPoint {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface RegionPlane {
  right: DrawPoint;
  up: DrawPoint;
  normal: DrawPoint;
}

/**
 * Stores the already-generated and already-filtered decal geometry.
 *
 * Without this cache, the application has to:
 * 1. Generate DecalGeometry.
 * 2. Inspect every decal triangle.
 * 3. Raycast every triangle against the source model.
 *
 * Caching means that expensive process only occurs when the annotation is
 * initially created, rather than every time the model viewer is opened.
 */
export interface CachedProjectedGeometry {
  positions: number[];
  normals?: number[];
  uvs?: number[];
}

export interface ProjectedMaskData {
  /**
   * Identifies which mesh inside the loaded GLB receives the projection.
   */
  meshIndex: number;

  /**
   * World-space centre of the decal projector.
   */
  position: DrawPoint;

  /**
   * World-space Euler rotation of the decal projector.
   */
  orientation: DrawPoint;

  /**
   * Width, height and depth of the decal projector.
   */
  size: DrawPoint;

  /**
   * Normalized 0–1 points used to reconstruct the alpha mask.
   */
  maskPoints: ScreenPoint[];

  /**
   * `stroke` is used for freehand highlights.
   * `fill` is used for closed region annotations.
   */
  mode: 'stroke' | 'fill';

  /**
   * Normalized brush width for stroke annotations.
   */
  brushWidth?: number;

  /**
   * Generated once and reused on subsequent model loads.
   */
  cachedGeometry?: CachedProjectedGeometry;
}

export interface Annotation {
  id?: number;
  label: string;
  description: string;
  kind: AnnotationKind;
  position: DrawPoint;

  /**
   * Legacy annotation properties.
   */
  drawPoints?: DrawPoint[];
  regionPlane?: RegionPlane;
  regionTriangles?: DrawPoint[];

  /**
   * New projected highlight/region data.
   */
  projectedMask?: ProjectedMaskData;

  /**
   * Camera direction and distance saved when the annotation was created.
   */
  view?: {
    x: number;
    y: number;
    z: number;
    distance: number;
  };
}

export interface ModelRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
}