import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { useToast } from '../context/ToastContextState';
import { useAppContext } from '../context/AppContextState';
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
  toAnnotationPayload, fromDbAnnotation,
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
import { hasRegionArea, normalizeDrawingPoint } from '../components/viewer/drawingSamples';
import { useDrawingSamples } from '../components/viewer/useDrawingSamples';
import { bindViewerEvents } from '../components/viewer/bindViewerEvents';
import { getBasicAnnotationVisuals } from '../components/viewer/basicAnnotationVisuals';
import { getModelFraming } from '../components/viewer/modelFraming';
import { repositionAnnotation } from '../components/viewer/repositionAnnotation';
import type { ViewerMode } from '../components/viewer/viewerMode';

type Raycast = (event: MouseEvent, objects: THREE.Object3D[], recursive?: boolean) => THREE.Intersection[];
type ModelHit = (event: MouseEvent) => THREE.Intersection | undefined;

export default function Viewer() {
  const { modelId } = useParams();
  const { role } = useAppContext();
  const { toast } = useToast();
  const [isMoving, setIsMoving] = useState(false);
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);

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
  const markerSizeRef = useRef(0.1);
  const modelCenterRef = useRef(new THREE.Vector3());

  const markersRef = useRef<THREE.Mesh[]>([]);
  const hotspotsRef = useRef<THREE.Sprite[]>([]);
  const annotationHitTargetsRef = useRef<THREE.Mesh[]>([]);
  const pendingObjectsRef = useRef<THREE.Mesh[]>([]);
  const repositionRef = useRef<Annotation | null>(null);
  const pendingPointRef = useRef<THREE.Vector3 | null>(null);
  const pendingAnnotationRef = useRef<Annotation | null>(null);
  const editingAnnotationRef = useRef<Annotation | null>(null);
  const sceneEpochRef = useRef(0);

  const isDrawingRef = useRef(false);
  const drawing = useDrawingSamples();

  const { selectedModel, modelVideos, loadError, saveNeutralView } = useViewerContent(modelId);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annotationsRef = useRef(annotations);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
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

  useEffect(() => { modeRef.current = mode; if (mode !== 'point') repositionRef.current = null; }, [mode]);

  useEffect(() => {
    annotationsVisibleRef.current = annotationsVisible;
  }, [annotationsVisible]);

  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.background = new THREE.Color(
      darkBackground ? 0x0f172a : 0xf8fafc,
    );
  }, [darkBackground]);

  // Effect Events keep input/async completion callbacks current without recreating WebGL on UI edits.
  const onModelLoaded = useEffectEvent((model: THREE.Object3D) => {
    if (!selectedModel) { disposeModelResources(model); return null; }
    const epoch = sceneEpochRef.current;
    modelRef.current = model;
    sourceMeshesRef.current = [];

    model.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const meshIndex = sourceMeshesRef.current.length;
      mesh.userData.viewerMeshIndex = meshIndex;
      sourceMeshesRef.current.push(mesh);
    });

    sceneRef.current?.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (bounds.isEmpty() || !Number.isFinite(sphere.radius)) {
      disposeModelResources(model);
      modelRef.current = null;
      sourceMeshesRef.current = [];
      setAssetLoading(false);
      setAssetError('This file does not contain a renderable model.');
      return null;
    }
    markerSizeRef.current = Math.max(...bounds.getSize(new THREE.Vector3()).toArray()) * 0.015;
    modelCenterRef.current.copy(sphere.center);
    const camera = cameraRef.current;
    if (camera) {
      const frame = getModelFraming(sphere.radius, camera.aspect, camera.fov);
      camera.near = frame.near;
      camera.far = frame.far;
      camera.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.minDistance = frame.minDistance;
        controlsRef.current.maxDistance = frame.maxDistance;
      }
    }

    if (selectedModel.neutral_view) {
      applyNeutralView(selectedModel.neutral_view);
    } else {
      centerCamera(model);
    }

    void loadViewerAnnotations(selectedModel.id, { getAnnotations: api.getAnnotations, updateAnnotation: role === 'teacher' ? api.updateAnnotation : async (id, payload) => ({id,...payload}) }, {
      isActive: () => sceneEpochRef.current === epoch,
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
      onError: () => setAssetError('Some annotations could not be loaded or saved. Reload the model to try again.'),
    }).finally(() => { if (sceneEpochRef.current === epoch) setAssetLoading(false); });

    return !selectedModel.thumbnail_path && role === 'teacher' ? selectedModel.id : null;
  });

  const onCanvasClick = useEffectEvent((event: MouseEvent, raycast: Raycast, getModelHit: ModelHit) => {
      if (assetLoading || isMoving || editor.form) return;
      if (modeRef.current === 'highlight' || modeRef.current === 'region') return;

      if (modeRef.current === 'point') {
        const hit = getModelHit(event);
        if (!hit) return;
        if (repositionRef.current) {
          const original = repositionRef.current;
          repositionRef.current = null;
          const moved = repositionAnnotation(original, vectorToPoint(hit.point), hit.object.userData.viewerMeshIndex as number, getViewData());
          const epoch=sceneEpochRef.current;
          setIsMoving(true);
          void api.updateAnnotation(original.id!,toAnnotationPayload(moved)).then((record)=>{
            if (sceneEpochRef.current!==epoch) return;
            const saved=fromDbAnnotation(record);
            clearAnnotationHitTargets((target)=>target.userData.annotation?.id===saved.id);
            markersRef.current=markersRef.current.filter((marker)=>{if(marker.userData.annotation?.id!==saved.id)return true;disposeMarker(marker);return false;});
            createAnnotationVisual(saved);
            setAnnotations((previous)=>previous.map((item)=>item.id===saved.id?saved:item));
            clearHotspots();
            annotationsRef.current.map((item)=>item.id===saved.id?saved:item).forEach((item,index)=>createAnnotationHotspot(item,index+1));
            setPopupAnnotation(saved);
          }).catch(()=>{ if (sceneEpochRef.current===epoch) toast('Could not move the annotation. Please try again.', 'error'); })
            .finally(()=>{ if (sceneEpochRef.current===epoch) setIsMoving(false); });
          setMode('view');
          return;
        }
        pendingPointRef.current = hit.point.clone();
        editor.openForm();
        return;
      }

      if (!annotationsVisibleRef.current) return;
      const accepted = raycast(event, hotspotsRef.current)[0] ?? raycast(event, annotationHitTargetsRef.current).find(isPaintedHit) ?? raycast(event, markersRef.current, true).find(isPaintedHit);
      if (!accepted) return;
      const marker = accepted.object as THREE.Mesh;
      const annotation = marker.userData.annotation as Annotation;
      if (!annotation) return;

      setPopupAnnotation(annotation);
  });

  const onDrawStart = useEffectEvent((event: PointerEvent, hit: ModelHit) => {
    drawing.start();
    clearPendingObjects();
    addProjectedPoint(event, hit);
  });
  const onDrawMove = useEffectEvent((event: PointerEvent, hit: ModelHit) => addProjectedPoint(event, hit));
  const onDrawFinish = useEffectEvent((kind: 'stroke' | 'fill') => {
    try { finishProjectedAnnotation(kind); }
    catch {
      clearPendingObjects();
      pendingAnnotationRef.current = null;
      setMode('view');
      toast('Could not create the annotation on this surface. Please try again.', 'error');
    } finally { setIsGeneratingRegion(false); }
  });
  const onHover = useEffectEvent((event: PointerEvent) => handleAnnotationHover(event));
  const onSceneStart = useEffectEvent(() => {
    setAssetError(null);
    setAssetLoading(true);
    setIsMoving(false);
    setAnnotations([]);
    setPopupAnnotation(null);
    setHoveredAnnotation(null);
    setMode('view');
    setIsGeneratingRegion(false);
    return darkBackground ? 0x0f172a : 0xf8fafc;
  });
  const onSceneCleanup = useEffectEvent(() => {
    clearAnnotationHitTargets();
    clearMarkers();
    clearHotspots();
    clearPendingObjects();
    repositionRef.current = null;
    pendingPointRef.current = null;
    pendingAnnotationRef.current = null;
    editingAnnotationRef.current = null;
    isDrawingRef.current = false;
    drawing.start();
    editor.reset();
  });
  const onDrawCancel = useEffectEvent(() => {
    isDrawingRef.current = false;
    drawing.start();
    clearPendingObjects();
    setIsGeneratingRegion(false);
  });
  const canStartDrawing = useEffectEvent(() => !assetLoading && !editor.form && !isGeneratingRegion);
  const sceneModelId = selectedModel?.id;
  const modelPath = selectedModel?.file_path;
  useEffect(() => {
    if (!sceneModelId || !modelPath || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    let projectionTimeout: ReturnType<typeof setTimeout> | undefined;
    let thumbnailModelId: number | null = null;
    sceneEpochRef.current += 1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(onSceneStart());
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.005, 1000);
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch {
      sceneRef.current = null;
      cameraRef.current = null;
      queueMicrotask(() => { if (!disposed) { setAssetLoading(false); setAssetError('3D rendering is unavailable. Enable WebGL or try another browser.'); } });
      return () => { disposed = true; sceneEpochRef.current += 1; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute('aria-label', 'Interactive anatomy model');
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
    const objectLoader = modelPath.toLowerCase().endsWith('.usdz') ? new USDLoader() : new OBJLoader();
    const loader = /\.(obj|usdz)$/i.test(modelPath)
      ? { load: (url: string, onLoad: (result: {scene:THREE.Object3D}) => void, progress: undefined, onError: (error: unknown) => void) => objectLoader.load(url, (scene) => onLoad({scene}), progress, onError) }
      : new GLTFLoader();
    loader.load(modelPath, (gltf) => {
      if (disposed) { disposeModelResources(gltf.scene); return; }
      thumbnailModelId = onModelLoaded(gltf.scene);
    }, undefined, () => {
      if (!disposed) { setAssetLoading(false); setAssetError('Could not load this model. Verify the format and any required companion files.'); }
    });
    const raycaster = new THREE.Raycaster();
    const raycast: Raycast = (event, objects, recursive = false) => {
      const screen = normalizeDrawingPoint(event, renderer.domElement.getBoundingClientRect());
      if (!screen) return [];
      raycaster.setFromCamera(new THREE.Vector2(screen.x * 2 - 1, 1 - screen.y * 2), camera);
      return raycaster.intersectObjects(objects, recursive);
    };
    const getModelHit: ModelHit = (event) => raycast(event, sourceMeshesRef.current)[0];
    let drawingPointer: number | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      if (!canStartDrawing() || !event.isPrimary || event.button !== 0 || drawingPointer !== null ||
          (modeRef.current !== 'highlight' && modeRef.current !== 'region')) return;
      drawingPointer = event.pointerId;
      renderer.domElement.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;
      controls.enabled = false;
      onDrawStart(event, getModelHit);
    };
    const releaseDrawing = () => {
      if (drawingPointer !== null && renderer.domElement.hasPointerCapture(drawingPointer))
        renderer.domElement.releasePointerCapture(drawingPointer);
      drawingPointer = null;
      controls.enabled = true;
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (isDrawingRef.current && drawingPointer === event.pointerId) onDrawMove(event, getModelHit);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!isDrawingRef.current || drawingPointer !== event.pointerId) return;
      isDrawingRef.current = false;
      releaseDrawing();
      if (modeRef.current === 'region') {
        setIsGeneratingRegion(true);
        projectionTimeout = setTimeout(() => { if (!disposed) onDrawFinish('fill'); }, 30);
      } else onDrawFinish('stroke');
    };
    const cancelDrawing = () => {
      clearTimeout(projectionTimeout);
      releaseDrawing();
      onDrawCancel();
    };
    const handleResize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const unbindEvents = bindViewerEvents(renderer.domElement, {
      click: (event) => onCanvasClick(event, raycast, getModelHit),
      pointerDown: handlePointerDown, pointerMove: handlePointerMove,
      pointerUp: handlePointerUp, pointerCancel: () => { if (isDrawingRef.current) cancelDrawing(); },
      hover: (event) => onHover(event), resize: handleResize,
    });
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      if (thumbnailModelId !== null) {
        const id = thumbnailModelId;
        thumbnailModelId = null;
        api.saveModelThumbnail(id, renderer.domElement.toDataURL('image/png')).catch(console.error);
      }
    };
    animate();
    return () => {
      disposed = true;
      sceneEpochRef.current += 1;
      cancelAnimationFrame(animationId);
      clearTimeout(projectionTimeout);
      unbindEvents();
      resizeObserver.disconnect();
      releaseDrawing();
      onSceneCleanup();
      if (modelRef.current) disposeModelResources(modelRef.current);
      modelRef.current = null;
      sourceMeshesRef.current = [];
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [sceneModelId, modelPath]);

  function disposeModelResources(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const skeletons = new Set<THREE.Skeleton>();
    const images = new Set<ImageBitmap>();
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      geometries.add(child.geometry);
      if (child instanceof THREE.SkinnedMesh) skeletons.add(child.skeleton);
      const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
      meshMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value: unknown) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    textures.forEach((texture) => {
      const data: unknown = texture.source.data;
      for (const image of Array.isArray(data) ? data : [data]) {
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) images.add(image);
      }
      texture.dispose();
    });
    images.forEach((image) => image.close());
    skeletons.forEach((skeleton) => skeleton.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    object.removeFromParent();
  }

  const onVisibilityChange = useEffectEvent(() => {
    setAnnotationVisibility(
      popupAnnotation,
      hoveredAnnotation,
    );
  });
  useEffect(() => { onVisibilityChange(); }, [
    annotationsVisible,
    popupAnnotation,
    hoveredAnnotation,
    annotations,
  ]);

  function centerCamera(object: THREE.Object3D) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    modelCenterRef.current.copy(sphere.center);

    controls.target.copy(sphere.center);

    const frame = getModelFraming(sphere.radius, camera.aspect, camera.fov);
    const position = sphere.center.clone().add(new THREE.Vector3(0, 0.6, 2.5).normalize().multiplyScalar(frame.distance));
    controls.minDistance = frame.minDistance;
    controls.maxDistance = Math.max(frame.maxDistance, frame.distance * 2);

    syncCamera(position, sphere.center);
  }

  function getMarkerSize() { return markerSizeRef.current; }

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

    if (mode === 'fill' && !hasRegionArea(screenPoints)) {
      toast('Draw a region with an enclosed area.', 'error');
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
      toast('The projected annotation could not be created on this surface.', 'error');
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
    if (!rendererRef.current || !cameraRef.current || isDrawingRef.current || modeRef.current !== 'view') return;
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

    const epoch = sceneEpochRef.current;
    if (!await editor.deleteAnnotation(annotation.id) || sceneEpochRef.current !== epoch) return;

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
      marker.visible = annotationsVisible && isAnnotationActive(marker.userData.annotation as Annotation | undefined, selected, hovered);
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
    // Consume residual orbit/pan/zoom deltas before applying an explicit camera pose.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    controls.update();
    controls.enableDamping = damping;
  }
  function applyNeutralView(neutralView: NeutralView) {
    syncCamera(pointToVector(neutralView.cameraPosition), pointToVector(neutralView.target));
  }

  function returnToNeutralView() {
    if (selectedModel?.neutral_view) applyNeutralView(selectedModel.neutral_view);
    else if (modelRef.current) centerCamera(modelRef.current);
  }

  return (
    <div ref={viewerRef} className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50">
      <div ref={containerRef} className="absolute inset-0" />
      <ViewerOverlay
        key={selectedModel?.id ?? modelId}
        boundaryRef={viewerRef} onDragStateChange={handlePanelDrag}
        model={selectedModel} loading={assetLoading} moving={isMoving} loadError={assetError || loadError} mode={mode} onModeChange={setMode}
        annotations={annotations} selectedAnnotation={popupAnnotation} videos={modelVideos}
        annotationsVisible={annotationsVisible} darkBackground={darkBackground}
        generatingRegion={isGeneratingRegion} boundaryPreview={drawing.preview}
        form={editor.form} onSelect={focusAnnotation} onHover={setHoveredAnnotation}
        onReposition={() => { repositionRef.current = popupAnnotation; setPopupAnnotation(null); setMode('point'); }}
        onClose={() => setPopupAnnotation(null)} onEdit={editSelectedAnnotation} onDelete={deleteSelectedAnnotation}
        onToggleAnnotations={() => setAnnotationsVisible((visible) => !visible)}
        onToggleBackground={() => setDarkBackground((dark) => !dark)}
        onSaveNeutralView={() => { void saveNeutralView(getCurrentNeutralView()); }} onReturnToNeutralView={returnToNeutralView}
      />
    </div>
  );
}
