import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useParams } from 'react-router-dom';
import { api } from '../api/api';
import type {
  Annotation,
  DrawPoint,
  NeutralView,
} from '../components/viewer/types';
import {
  maskContainsUv,
  createProjectedMaskMesh,
  disposeProjectedMask,
  simplifyScreenPoints,
} from '../components/viewer/projectedMask';
import {
  isAnnotationActive,
  createProjectedAnnotation,
} from '../components/viewer/annotationMapping';
import {
  buildProjectedMaskData,
  getDominantMeshIndex,
  vectorToPoint,
} from '../components/viewer/projectedMaskData';
import { useViewerContent } from '../components/viewer/useViewerContent';
import ViewerOverlay from '../components/viewer/ViewerOverlay';
import { useAnnotationEditor } from '../components/viewer/useAnnotationEditor';
import { createAnnotationBadge } from '../components/viewer/createAnnotationBadge';
import { loadViewerAnnotations } from '../components/viewer/loadViewerAnnotations';
import { normalizeDrawingPoint } from '../components/viewer/drawingSamples';
import { useDrawingSamples } from '../components/viewer/useDrawingSamples';
import { bindViewerEvents } from '../components/viewer/bindViewerEvents';
import { getBasicAnnotationVisuals } from '../components/viewer/basicAnnotationVisuals';
import type { ViewerMode } from '../components/viewer/viewerMode';

export default function Viewer() {
  const { modelId } = useParams();

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const handlePanelDrag = useCallback((dragging: boolean) => {
    if (controlsRef.current) controlsRef.current.enabled = !dragging;
  }, []);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const sourceMeshesRef = useRef<THREE.Mesh[]>([]);
  const modelCenterRef = useRef(new THREE.Vector3());

  const markersRef = useRef<THREE.Mesh[]>([]);
  const hotspotsRef = useRef<THREE.Sprite[]>([]);
  const annotationHitTargetsRef = useRef<THREE.Mesh[]>([]);
  const pendingObjectsRef = useRef<THREE.Mesh[]>([]);
  const pendingPointRef = useRef<THREE.Vector3 | null>(null);
  const pendingAnnotationRef = useRef<Annotation | null>(null);
  const editingAnnotationRef = useRef<Annotation | null>(null);
  const sceneEpochRef = useRef(0);

  const isDrawingRef = useRef(false);
  const drawing = useDrawingSamples();

  const { selectedModel, modelVideos, loadError, saveNeutralView } = useViewerContent(modelId);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mode, setMode] = useState<ViewerMode>('view');
  const modeRef = useRef<ViewerMode>(mode);
  const [popupAnnotation, setPopupAnnotation] = useState<Annotation | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  const [isGeneratingRegion, setIsGeneratingRegion] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const annotationsVisibleRef = useRef(annotationsVisible);
  const [darkBackground, setDarkBackground] = useState(false);
  const editor = useAnnotationEditor({
    getModelId: () => selectedModel?.id,
    getSceneEpoch: () => sceneEpochRef.current,
    getAnnotation: () => editingAnnotationRef.current ?? pendingAnnotationRef.current ?? (
      pendingPointRef.current ? {
        label: '', description: '', kind: 'point',
        position: vectorToPoint(pendingPointRef.current), view: getViewData(),
      } : null
    ),
    onSaved: handleAnnotationSaved,
    onCancel: cancelForm,
  });

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    annotationsVisibleRef.current = annotationsVisible;
  }, [annotationsVisible]);

  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.background = new THREE.Color(
      darkBackground ? 0x0f172a : 0xf8fafc,
    );
  }, [darkBackground]);

  useEffect(() => {
    if (!selectedModel || !containerRef.current) return;

    const container = containerRef.current;
    let disposed = false;
    let thumbnailFrame = 0;
    let projectionTimeout: ReturnType<typeof setTimeout> | undefined;
    sceneEpochRef.current += 1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.005,
      1000,
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 5);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(
      `http://localhost:5000${selectedModel.file_path}`,
      (gltf) => {
        if (disposed) {
          disposeModelResources(gltf.scene);
          return;
        }
        const model = gltf.scene;
        modelRef.current = model;
        sourceMeshesRef.current = [];

        model.traverse((object) => {
          if (!(object as THREE.Mesh).isMesh) return;
          const mesh = object as THREE.Mesh;
          const meshIndex = sourceMeshesRef.current.length;
          mesh.userData.viewerMeshIndex = meshIndex;
          sourceMeshesRef.current.push(mesh);

          console.log({
            mesh: mesh.name || '(unnamed)',
            vertices: mesh.geometry.attributes.position?.count ?? 0,
            hasUV: Boolean(mesh.geometry.attributes.uv),
            uvCount: mesh.geometry.attributes.uv?.count ?? 0,
          });
        });

        scene.add(model);

        if (selectedModel.neutral_view) {
          applyNeutralView(selectedModel.neutral_view);
        } else {
          centerCamera(model);
        }

        void loadViewerAnnotations(selectedModel.id, api, {
          isActive: () => !disposed,
          replace: (loaded) => {
            clearAnnotationHitTargets();
            clearMarkers();
            clearHotspots();
            setAnnotations(loaded);
          },
          render: (annotation, number) => {
            createAnnotationVisual(annotation);
            createAnnotationHotspot(annotation, number);
          },
          onError: console.error,
        });
        if (!selectedModel.thumbnail_path) {
          thumbnailFrame = requestAnimationFrame(() => {
            if (disposed) return;
            renderer.render(scene, camera);
            const thumbnail = renderer.domElement.toDataURL('image/png');
            api.saveModelThumbnail(selectedModel.id, thumbnail).catch(console.error);
          });
        }
      },
      undefined,
      (error) => console.error('Model loading failed:', error),
    );

    const raycaster = new THREE.Raycaster();
    const raycast = (event: MouseEvent, objects: THREE.Object3D[], recursive = false) => {
      const screen = normalizeDrawingPoint(event, renderer.domElement.getBoundingClientRect());
      if (!screen) return [];
      raycaster.setFromCamera(new THREE.Vector2(screen.x * 2 - 1, 1 - screen.y * 2), camera);
      return raycaster.intersectObjects(objects, recursive);
    };
    const getModelHit = (event: MouseEvent) => raycast(event, sourceMeshesRef.current)[0];

    const handleClick = (event: MouseEvent) => {
      if (modeRef.current === 'highlight' || modeRef.current === 'region') return;

      if (modeRef.current === 'point') {
        const hit = getModelHit(event);
        if (!hit) return;
        pendingPointRef.current = hit.point.clone();
        editor.openForm();
        return;
      }

      const accepted = raycast(event, markersRef.current, true).find(isPaintedHit);
      if (!accepted) return;
      const marker = accepted.object as THREE.Mesh;
      const annotation = marker.userData.annotation as Annotation;
      if (!annotation) return;

      setPopupAnnotation(annotation);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (modeRef.current !== 'highlight' && modeRef.current !== 'region') return;
      isDrawingRef.current = true;
      controls.enabled = false;
      drawing.start();
      clearPendingObjects();

      addProjectedPoint(event, getModelHit);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current) return;
      addProjectedPoint(event, getModelHit);
    };

    const handlePointerUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      controls.enabled = true;

      if (modeRef.current === 'region') {
        setIsGeneratingRegion(true);
        projectionTimeout = setTimeout(() => {
          if (disposed) return;
          finishProjectedAnnotation('fill');
          setIsGeneratingRegion(false);
        }, 30);
      } else {
        finishProjectedAnnotation('stroke');
      }
    };

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const unbindEvents = bindViewerEvents(renderer.domElement, {
      click: handleClick, pointerDown: handlePointerDown, pointerMove: handlePointerMove,
      pointerUp: handlePointerUp, hover: handleAnnotationHover, resize: handleResize,
    });

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      controls.update();

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      sceneEpochRef.current += 1;
      cancelAnimationFrame(animationId);
      cancelAnimationFrame(thumbnailFrame);
      clearTimeout(projectionTimeout);
      unbindEvents();
      clearAnnotationHitTargets();
      clearMarkers();
      clearHotspots();
      clearPendingObjects();
      pendingPointRef.current = null;
      pendingAnnotationRef.current = null;
      editingAnnotationRef.current = null;
      isDrawingRef.current = false;
      if (modelRef.current) disposeModelResources(modelRef.current);
      modelRef.current = null;
      sourceMeshesRef.current = [];
      controls.dispose();
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [selectedModel]);

  function disposeModelResources(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      geometries.add(child.geometry);
      const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
      meshMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value: unknown) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    object.removeFromParent();
  }

  useEffect(() => {
    setAnnotationVisibility(
      popupAnnotation,
      hoveredAnnotation,
    );
  }, [
    annotationsVisible,
    popupAnnotation,
    hoveredAnnotation,
  ]);

  function centerCamera(object: THREE.Object3D) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    modelCenterRef.current.copy(sphere.center);

    controls.target.copy(sphere.center);

    camera.position.set(
      sphere.center.x,
      sphere.center.y + sphere.radius * 0.6,
      sphere.center.z + sphere.radius * 2.5,
    );

    /*
    * Keep the camera outside the bounding sphere.
    */
    controls.minDistance = sphere.radius * 0.03;
    controls.maxDistance = sphere.radius * 8;

    camera.lookAt(sphere.center);
    controls.update();
  }

  function getMarkerSize() {
    if (!modelRef.current) return 0.1;
    const size = new THREE.Box3().setFromObject(modelRef.current).getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z) * 0.015;
  }

  function getViewData() {
    if (!cameraRef.current || !controlsRef.current) return undefined;
    const direction = cameraRef.current.position
      .clone()
      .sub(controlsRef.current.target)
      .normalize();
    return {
      x: direction.x,
      y: direction.y,
      z: direction.z,
      distance: cameraRef.current.position.distanceTo(controlsRef.current.target),
    };
  }

  function addProjectedPoint(
    event: PointerEvent,
    getModelHit: (event: PointerEvent | MouseEvent) => THREE.Intersection | undefined,
  ) {
    if (!rendererRef.current) return;

    const screen = normalizeDrawingPoint(event, rendererRef.current.domElement.getBoundingClientRect());
    if (!screen || !drawing.accepts(screen)) return;
    const hit = getModelHit(event);
    if (!hit) return;
    drawing.append(screen, vectorToPoint(hit.point), hit.object.userData.viewerMeshIndex as number);
  }
  function finishProjectedAnnotation(mode: 'stroke' | 'fill') {
    const samples = drawing.finish();
    const screenPoints = simplifyScreenPoints(samples.screenPoints);
    const worldPoints = samples.worldPoints.map((point) => new THREE.Vector3(point.x, point.y, point.z));

    if (
      screenPoints.length < (mode === 'fill' ? 4 : 2) ||
      worldPoints.length < 2 ||
      !cameraRef.current
    ) {
      clearPendingObjects();
      setMode('view');
      return;
    }

    const meshIndex = getDominantMeshIndex(samples.meshIndices);
    const camera = cameraRef.current;
    camera.updateMatrixWorld(true);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const orientation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
    const projectedMask = buildProjectedMaskData(
      {
        right: vectorToPoint(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()),
        up: vectorToPoint(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()),
        forward: vectorToPoint(forward),
        orientation: { x: orientation.x, y: orientation.y, z: orientation.z },
      },
      getMarkerSize(),
      screenPoints,
      worldPoints,
      meshIndex,
      mode,
    );

    const annotation = createProjectedAnnotation(projectedMask, getViewData());

    pendingAnnotationRef.current = annotation;
    clearPendingObjects();
    const preview = createProjectedVisual(annotation);
    if (!preview) {
      pendingAnnotationRef.current = null;
      alert('The projected annotation could not be created on this surface.');
      setMode('view');
      return;
    }

    pendingObjectsRef.current = [preview];
    editor.openForm(annotation);
    setMode('view');
  }

  function createProjectedVisual(annotation: Annotation) {
    if (!sceneRef.current || !annotation.projectedMask) return null;
    const sourceMesh = sourceMeshesRef.current[annotation.projectedMask.meshIndex];
    if (!sourceMesh) return null;
    const mesh = createProjectedMaskMesh(sourceMesh, annotation);
    if (!mesh) return null;
    return addSceneObject(mesh);
  }

  function addSceneObject<T extends THREE.Object3D>(object: T, collection?: T[]) {
    sceneRef.current?.add(object);
    collection?.push(object);
    return object;
  }

  function pointToVector(point: DrawPoint) {
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  function createBasicVisuals(annotation: Annotation) {
    if (!sceneRef.current) return;
    for (const spec of getBasicAnnotationVisuals(annotation, getMarkerSize())) {
      const geometry = spec.shape === 'sphere'
        ? new THREE.SphereGeometry(spec.radius, spec.segments, spec.segments)
        : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(spec.vertices, 3));
      const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial(spec.material));
      marker.position.set(spec.position.x, spec.position.y, spec.position.z);
      marker.userData.annotation = annotation;
      addSceneObject(marker, markersRef.current);
    }
  }

  function createAnnotationHotspot(annotation: Annotation, number: number) {
    if (!sceneRef.current) return;
    const canvas = createAnnotationBadge(number, annotation.color ?? '#2563eb');
    if (!canvas) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const hotspot = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }));
    hotspot.position.copy(pointToVector(annotation.position));
    const size = getMarkerSize() * 2;
    hotspot.scale.set(size, size, 1);
    if (annotation.view) {
      hotspot.position.addScaledVector(pointToVector(annotation.view).normalize(), size * 0.75);
    }
    Object.assign(hotspot.userData, {
      annotation, annotationNumber: number, isAnnotationHotspot: true,
    });
    hotspot.visible = annotationsVisibleRef.current;
    addSceneObject(hotspot, hotspotsRef.current);
  }

  function createAnnotationHitTarget(annotation: Annotation, visual: THREE.Mesh) {
    if (!sceneRef.current) return;

    const hitTarget = new THREE.Mesh(visual.geometry, new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    }));
    hitTarget.position.copy(visual.position);
    hitTarget.rotation.copy(visual.rotation);
    hitTarget.scale.copy(visual.scale);
    Object.assign(hitTarget.userData, {
      annotation, isAnnotationHitTarget: true, maskCanvas: visual.userData.maskCanvas,
    });
    addSceneObject(hitTarget, annotationHitTargetsRef.current);
  }

  function isPaintedHit(hit: THREE.Intersection) {
    const canvas = hit.object.userData.maskCanvas as HTMLCanvasElement | undefined;
    return !canvas || Boolean(hit.uv && maskContainsUv(canvas, hit.uv));
  }

  function handleAnnotationHover(event: PointerEvent) {
    if (!rendererRef.current || !cameraRef.current) return;
    if (!annotationsVisibleRef.current) { setHoveredAnnotation(null); return; }
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const screen = normalizeDrawingPoint(event, rect);
    if (!screen) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(screen.x * 2 - 1, 1 - screen.y * 2), cameraRef.current);
    // Numbered hotspots take priority; mask targets only accept painted pixels.
    const hit = raycaster.intersectObjects(hotspotsRef.current, false)[0]
      ?? raycaster.intersectObjects(annotationHitTargetsRef.current, false).find(isPaintedHit);
    setHoveredAnnotation(hit ? hit.object.userData.annotation as Annotation : null);
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
    createBasicVisuals(annotation);
    markersRef.current.forEach((marker) => {
      if (marker.userData.annotation?.id === annotation.id) marker.visible = false;
    });
  }
  function disposeMarker(marker: THREE.Mesh, ownsGeometry = true) {
    if (ownsGeometry && marker.userData.isProjectedMask) {
      disposeProjectedMask(marker);
      return;
    }
    marker.removeFromParent();
    if (ownsGeometry) marker.geometry.dispose();
    if (Array.isArray(marker.material)) marker.material.forEach((material) => material.dispose());
    else marker.material.dispose();
  }

  function clearPendingObjects() {
    pendingObjectsRef.current.forEach((marker) => disposeMarker(marker));
    pendingObjectsRef.current = [];
  }

  function clearMarkers() {
    markersRef.current.forEach((marker) => disposeMarker(marker));
    markersRef.current = [];
    setPopupAnnotation(null);
  }

  function clearAnnotationHitTargets(matches: (target: THREE.Mesh) => boolean = () => true) {
    annotationHitTargetsRef.current = annotationHitTargetsRef.current.filter((hitTarget) => {
      if (!matches(hitTarget)) return true;
      disposeMarker(hitTarget, false); // Geometry belongs to its visible annotation.
      return false;
    });
  }


  function updateMarkerAnnotation(marker: THREE.Mesh, annotation: Annotation) {
    marker.userData.annotation = annotation;
    if (!(marker.material instanceof THREE.MeshBasicMaterial)) return;
    if (annotation.kind === 'projectedRegion') {
      marker.material.color.set(annotation.color ?? '#22d3ee');
    }
    if (annotation.kind === 'projectedRegion' || annotation.kind === 'projectedDraw') {
      marker.material.opacity = annotation.opacity ?? (annotation.kind === 'projectedRegion' ? 0.24 : 0.32);
    }
    marker.material.needsUpdate = true;
  }

  function handleAnnotationSaved(saved: Annotation) {
    if (editingAnnotationRef.current) {
      markersRef.current.forEach((marker) => {
        if (marker.userData.annotation?.id === saved.id) updateMarkerAnnotation(marker, saved);
      });
      [...hotspotsRef.current, ...annotationHitTargetsRef.current].forEach((object) => {
        if (object.userData.annotation?.id === saved.id) object.userData.annotation = saved;
      });
      setAnnotations((previous) => previous.map((item) => item.id === saved.id ? saved : item));
      editingAnnotationRef.current = null;
    } else {
      if (pendingAnnotationRef.current) {
        pendingObjectsRef.current.forEach((object) => {
          updateMarkerAnnotation(object, saved);
          markersRef.current.push(object);
          createAnnotationHitTarget(saved, object);
        });
        pendingObjectsRef.current = [];
        pendingAnnotationRef.current = null;
      } else {
        createBasicVisuals(saved);
        pendingPointRef.current = null;
        setMode('view');
      }
      createAnnotationHotspot(saved, annotations.length + 1);
      setAnnotations((previous) => [...previous, saved]);
    }
    setPopupAnnotation(saved);
  }
  async function deleteSelectedAnnotation() {
    const annotation = popupAnnotation;
    if (!annotation) return;

    if (!await editor.deleteAnnotation(annotation.id)) return;

    clearAnnotationHitTargets((target) => target.userData.annotation?.id === annotation.id);
    markersRef.current = markersRef.current.filter((marker) => {
      if (marker.userData.annotation?.id !== annotation.id) return true;
      disposeMarker(marker);
      return false;
    });
    // Build the new annotation list immediately.
    const remainingAnnotations = annotations.filter(
      (item) => item.id !== annotation.id,
    );

    setAnnotations(remainingAnnotations);

    // Rebuild every numbered hotspot so numbering stays sequential.
    clearHotspots();

    remainingAnnotations.forEach((item, index) => {
      createAnnotationHotspot(item, index + 1);
    });

    setHoveredAnnotation(null);
    setPopupAnnotation(null);
  }

  function editSelectedAnnotation() {
    if (!popupAnnotation) return;
    editingAnnotationRef.current = popupAnnotation;
    editor.openForm(popupAnnotation, true);
    setPopupAnnotation(null);
  }
  function focusAnnotation(annotation: Annotation) {
    if (!cameraRef.current || !controlsRef.current) return;
    const position = pointToVector(annotation.position);
    const direction = annotation.view
      ? pointToVector(annotation.view)
      : cameraRef.current.position.clone().sub(position).normalize();
    const distance = annotation.view?.distance || 1;
    syncCamera(position.clone().add(direction.multiplyScalar(distance)), position);
    setPopupAnnotation(annotation);
    syncCamera(cameraRef.current.position, modelCenterRef.current);
  }

  function cancelForm() {
    editingAnnotationRef.current = null;
    setMode('view');
    pendingPointRef.current = null;
    pendingAnnotationRef.current = null;
    clearPendingObjects();
  }

  function setAnnotationVisibility(selected: Annotation | null, hovered: Annotation | null) {
    markersRef.current.forEach((marker) => {
      marker.visible = isAnnotationActive(marker.userData.annotation as Annotation | undefined, selected, hovered);
    });
    hotspotsRef.current.forEach((hotspot) => {
      hotspot.visible = annotationsVisible && !isAnnotationActive(hotspot.userData.annotation as Annotation | undefined, selected, hovered);
    });
  }
  function getCurrentNeutralView() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    return camera && controls ? {
      cameraPosition: vectorToPoint(camera.position),
      target: vectorToPoint(controls.target),
    } : null;
  }
  function syncCamera(position: THREE.Vector3, target: THREE.Vector3) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    controls.update();
  }
  function applyNeutralView(neutralView: NeutralView) {
    syncCamera(pointToVector(neutralView.cameraPosition), pointToVector(neutralView.target));
  }

  function returnToNeutralView() {
    if (selectedModel?.neutral_view) applyNeutralView(selectedModel.neutral_view);
  }

  return (
    <div ref={viewerRef} className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50">
      <div ref={containerRef} className="absolute inset-0" />
      <ViewerOverlay
        key={selectedModel?.id ?? modelId}
        boundaryRef={viewerRef} onDragStateChange={handlePanelDrag}
        model={selectedModel} loadError={loadError} mode={mode} onModeChange={setMode}
        annotations={annotations} selectedAnnotation={popupAnnotation} videos={modelVideos}
        annotationsVisible={annotationsVisible} darkBackground={darkBackground}
        generatingRegion={isGeneratingRegion} boundaryPreview={drawing.preview}
        form={editor.form} onSelect={focusAnnotation} onHover={setHoveredAnnotation}
        onClose={() => setPopupAnnotation(null)} onEdit={editSelectedAnnotation} onDelete={deleteSelectedAnnotation}
        onToggleAnnotations={() => setAnnotationsVisible((visible) => !visible)}
        onToggleBackground={() => setDarkBackground((dark) => !dark)}
        onSaveNeutralView={() => { void saveNeutralView(getCurrentNeutralView()); }} onReturnToNeutralView={returnToNeutralView}
      />
    </div>
  );
}
