import * as THREE from 'three';
import {
  createProjectedMaskMesh,
  disposeProjectedMask,
  maskContainsUv,
} from './projectedMask';
import type { Annotation } from './types';

interface AnnotationVisualDeps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  sourceMeshesRef: React.RefObject<THREE.Mesh[]>;
  markersRef: React.RefObject<THREE.Mesh[]>;
  hotspotsRef: React.RefObject<THREE.Sprite[]>;
  annotationHitTargetsRef: React.RefObject<THREE.Mesh[]>;
  pendingObjectsRef: React.RefObject<THREE.Mesh[]>;
  annotationsVisibleRef: React.RefObject<boolean>;
  getMarkerSize: () => number;
  setHoveredAnnotation: (annotation: Annotation | null) => void;
  setPopupAnnotation: (annotation: Annotation | null) => void;
}

/**
 * Groups the functions that create, hover-test, and dispose of a model's
 * annotation visuals (markers, numbered hotspots, projected decals, and
 * their invisible hit targets). Built once per Viewer render from the same
 * refs Viewer.tsx holds, so identity and timing match the original
 * in-component closures exactly.
 */
export function createAnnotationVisualController(deps: AnnotationVisualDeps) {
  const {
    sceneRef,
    rendererRef,
    cameraRef,
    sourceMeshesRef,
    markersRef,
    hotspotsRef,
    annotationHitTargetsRef,
    pendingObjectsRef,
    annotationsVisibleRef,
    getMarkerSize,
    setHoveredAnnotation,
    setPopupAnnotation,
  } = deps;

  function createProjectedVisual(annotation: Annotation) {
    if (!sceneRef.current || !annotation.projectedMask) return null;
    const sourceMesh = sourceMeshesRef.current[annotation.projectedMask.meshIndex];
    if (!sourceMesh) return null;
    const mesh = createProjectedMaskMesh(sourceMesh, annotation);
    if (!mesh) return null;
    sceneRef.current.add(mesh);
    return mesh;
  }

  function createPointMarker(annotation: Annotation) {
    if (!sceneRef.current) return;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(getMarkerSize(), 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xff1a00 }),
    );
    marker.position.set(annotation.position.x, annotation.position.y, annotation.position.z);
    marker.userData.annotation = annotation;
    sceneRef.current.add(marker);
    markersRef.current.push(marker);
  }

  function createHotspotTexture(number: number, annotation: Annotation) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Circular marker.
    context.beginPath();
    context.arc(128, 128, 100, 0, Math.PI * 2);

    context.fillStyle = annotation.color ?? '#2563eb';
    context.fill();

    // White outline.
    context.lineWidth = 12;
    context.strokeStyle = '#ffffff';
    context.stroke();

    // Annotation number.
    context.fillStyle = '#ffffff';
    context.font = 'bold 110px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(number), 128, 136);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  }

  function createAnnotationHotspot(annotation: Annotation, number: number) {
    if (!sceneRef.current) return;

    const texture = createHotspotTexture(number, annotation);

    if (!texture) return;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    const hotspot = new THREE.Sprite(material);

    const position = new THREE.Vector3(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z,
    );

    hotspot.position.copy(position);

    const size = getMarkerSize() * 2.0;

    hotspot.scale.set(size, size, 1);

    if (annotation.view) {
      const outwardDirection = new THREE.Vector3(
        annotation.view.x,
        annotation.view.y,
        annotation.view.z,
      ).normalize();

      hotspot.position.addScaledVector(outwardDirection, size * 0.75);
    }

    hotspot.userData.annotation = annotation;
    hotspot.userData.annotationNumber = number;
    hotspot.userData.isAnnotationHotspot = true;

    // Hidden until "Show All" is enabled.
    hotspot.visible = annotationsVisibleRef.current;

    sceneRef.current.add(hotspot);
    hotspotsRef.current.push(hotspot);
  }

  function createAnnotationHitTarget(annotation: Annotation, visual: THREE.Mesh) {
    if (!sceneRef.current) return;

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });

    const hitTarget = new THREE.Mesh(visual.geometry, material);

    hitTarget.position.copy(visual.position);
    hitTarget.rotation.copy(visual.rotation);
    hitTarget.scale.copy(visual.scale);

    hitTarget.userData.annotation = annotation;
    hitTarget.userData.isAnnotationHitTarget = true;
    hitTarget.userData.maskCanvas = visual.userData.maskCanvas;

    sceneRef.current.add(hitTarget);

    annotationHitTargetsRef.current.push(hitTarget);
  }

  function handleAnnotationHover(event: PointerEvent) {
    if (!rendererRef.current || !cameraRef.current) {
      return;
    }

    // Hover functionality only exists while Show All Annotations is enabled.
    if (!annotationsVisibleRef.current) {
      setHoveredAnnotation(null);
      return;
    }

    const canvas = rendererRef.current.domElement;
    const rect = canvas.getBoundingClientRect();

    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, cameraRef.current);

    // First check the numbered hotspots.
    const hotspotIntersections = raycaster.intersectObjects(hotspotsRef.current, false);

    if (hotspotIntersections.length > 0) {
      const annotation = hotspotIntersections[0].object.userData.annotation as Annotation;
      setHoveredAnnotation(annotation);
      return;
    }

    // Then check the invisible annotation geometry.
    const annotationIntersections = raycaster.intersectObjects(
      annotationHitTargetsRef.current,
      false,
    );

    const acceptedAnnotationHit = annotationIntersections.find((hit) => {
      const hitTarget = hit.object as THREE.Mesh;
      const maskCanvas = hitTarget.userData.maskCanvas as HTMLCanvasElement | undefined;

      // Non-masked annotations can use their complete geometry.
      if (!maskCanvas) {
        return true;
      }

      // Projected annotations only count when the cursor is actually over a
      // painted portion of the mask.
      return Boolean(hit.uv && maskContainsUv(maskCanvas, hit.uv));
    });

    if (acceptedAnnotationHit) {
      const annotation = acceptedAnnotationHit.object.userData.annotation as Annotation;
      setHoveredAnnotation(annotation);
      return;
    }

    setHoveredAnnotation(null);
  }

  function clearHotspots() {
    hotspotsRef.current.forEach((hotspot) => {
      hotspot.removeFromParent();
      const material = hotspot.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    });

    hotspotsRef.current = [];
  }

  function createLegacyVisual(annotation: Annotation) {
    if (!sceneRef.current) return;

    if (annotation.kind === 'draw' && annotation.drawPoints) {
      annotation.drawPoints.forEach((point) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(getMarkerSize() * 0.22, 8, 8),
          new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          }),
        );
        marker.position.set(point.x, point.y, point.z);
        marker.userData.annotation = annotation;
        sceneRef.current?.add(marker);
        markersRef.current.push(marker);
      });
      return;
    }

    if (annotation.kind === 'region' && annotation.regionTriangles) {
      const vertices = annotation.regionTriangles.flatMap((point) => [point.x, point.y, point.z]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      mesh.userData.annotation = annotation;
      sceneRef.current.add(mesh);
      markersRef.current.push(mesh);
    }
  }

  function createAnnotationVisual(annotation: Annotation) {
    if (annotation.kind === 'projectedDraw' || annotation.kind === 'projectedRegion') {
      const projected = createProjectedVisual(annotation);

      if (projected) {
        projected.visible = false;
        markersRef.current.push(projected);
        createAnnotationHitTarget(annotation, projected);
      }

      return;
    }

    if (annotation.kind === 'draw' || annotation.kind === 'region') {
      createLegacyVisual(annotation);

      markersRef.current.forEach((marker) => {
        if (marker.userData.annotation?.id === annotation.id) {
          marker.visible = false;
        }
      });

      return;
    }

    createPointMarker(annotation);

    markersRef.current.forEach((marker) => {
      if (marker.userData.annotation?.id === annotation.id) {
        marker.visible = false;
      }
    });
  }

  function disposeMarker(marker: THREE.Mesh) {
    if (marker.userData.isProjectedMask) {
      disposeProjectedMask(marker);
      return;
    }
    marker.removeFromParent();
    marker.geometry.dispose();
    if (Array.isArray(marker.material)) marker.material.forEach((material) => material.dispose());
    else marker.material.dispose();
  }

  function clearPendingObjects() {
    pendingObjectsRef.current.forEach(disposeMarker);
    pendingObjectsRef.current = [];
  }

  function clearMarkers() {
    markersRef.current.forEach(disposeMarker);
    markersRef.current = [];
    setPopupAnnotation(null);
  }

  function clearAnnotationHitTargets() {
    annotationHitTargetsRef.current.forEach((hitTarget) => {
      hitTarget.removeFromParent();

      const materials = Array.isArray(hitTarget.material)
        ? hitTarget.material
        : [hitTarget.material];

      materials.forEach((material) => {
        material.dispose();
      });

      // DO NOT dispose hitTarget.geometry.
      // It is shared with the actual annotation visual.
    });

    annotationHitTargetsRef.current = [];
  }

  return {
    createProjectedVisual,
    createPointMarker,
    createHotspotTexture,
    createAnnotationHotspot,
    createAnnotationHitTarget,
    handleAnnotationHover,
    clearHotspots,
    createLegacyVisual,
    createAnnotationVisual,
    disposeMarker,
    clearPendingObjects,
    clearMarkers,
    clearAnnotationHitTargets,
  };
}
