import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useParams } from 'react-router-dom';
import { api } from '../api/api';
import { useAppContext } from '../context/AppContext';
import AnnotationDetailsPanel from '../components/viewer/AnnotationDetailsPanel';
import AnnotationFormModal from '../components/viewer/AnnotationFormModal';
import AnnotationListPanel from '../components/viewer/AnnotationListPanel';
import RegionGeneratingOverlay from '../components/viewer/RegionGeneratingOverlay';
import ViewerInstructions from '../components/viewer/ViewerInstructions';
import ViewerToolbar from '../components/viewer/ViewerToolbar';
import type {
  Annotation,
  AnnotationKind,
  DrawPoint,
  ModelRecord,
  ProjectedMaskData,
  ScreenPoint,
} from '../components/viewer/types';
import {
  createProjectedMaskMesh,
  disposeProjectedMask,
  maskContainsUv,
  simplifyScreenPoints,
} from '../components/viewer/projectedMask';

interface LinkedVideo {
  id: number;
  title: string;
  video_path: string;
  annotation_id: number | null;
}

function toDbAnnotationType(
  kind: AnnotationKind,
): 'point' | 'highlight' | 'region_fill' {
  if (kind === 'point') return 'point';
  if (kind === 'draw' || kind === 'projectedDraw') return 'highlight';
  return 'region_fill';
}

function fromDbAnnotation(row: any): Annotation {
  const data = row.annotation_data ?? {};
  let kind: AnnotationKind;

  if (row.annotation_type === 'point') {
    kind = 'point';
  } else if (data.projectedMask) {
    kind = row.annotation_type === 'highlight' ? 'projectedDraw' : 'projectedRegion';
  } else if (row.annotation_type === 'highlight') {
    kind = 'draw';
  } else {
    kind = 'region';
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description || '',
    color:
      row.color ||
      (kind === 'projectedRegion'
        ? '#22d3ee'
        : kind === 'projectedDraw'
          ? '#facc15'
          : undefined),
    kind,
    position: data.position,
    drawPoints: data.drawPoints,
    regionPlane: data.regionPlane,
    regionTriangles: data.regionTriangles,
    projectedMask: data.projectedMask,
    view: data.view,
  };
}

export default function Viewer() {
  const { role } = useAppContext();
  const { modelId } = useParams();

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const sourceMeshesRef = useRef<THREE.Mesh[]>([]);
  const modelCenterRef = useRef(new THREE.Vector3());
  const modelRadiusRef = useRef(1);

  const markersRef = useRef<THREE.Mesh[]>([]);
  const pendingObjectsRef = useRef<THREE.Mesh[]>([]);
  const pendingPointRef = useRef<THREE.Vector3 | null>(null);
  const pendingAnnotationRef = useRef<Annotation | null>(null);
  const editingAnnotationRef = useRef<Annotation | null>(null);

  const addModeRef = useRef(false);
  const drawModeRef = useRef(false);
  const regionModeRef = useRef(false);
  const isDrawingRef = useRef(false);
  const currentWorldPointsRef = useRef<THREE.Vector3[]>([]);
  const currentScreenPointsRef = useRef<ScreenPoint[]>([]);
  const currentMeshHitsRef = useRef<number[]>([]);

  const [selectedModel, setSelectedModel] = useState<ModelRecord | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [regionMode, setRegionMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [popupAnnotation, setPopupAnnotation] = useState<Annotation | null>(null);
  const [modelVideos, setModelVideos] = useState<LinkedVideo[]>([]);
  const [playingVideo, setPlayingVideo] = useState<LinkedVideo | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#22d3ee');
  const [isGeneratingRegion, setIsGeneratingRegion] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [annotationsPanelOpen, setAnnotationsPanelOpen] = useState(true);
  const [regionBoundaryPreview, setRegionBoundaryPreview] = useState<ScreenPoint[]>([]);
  const [darkBackground, setDarkBackground] = useState(false);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    regionModeRef.current = regionMode;
  }, [regionMode]);

  useEffect(() => {
    if (!modelId) return;
    api.getModel(Number(modelId)).then(setSelectedModel).catch(console.error);
  }, [modelId]);

  useEffect(() => {
    if (!sceneRef.current) return;

    sceneRef.current.background = new THREE.Color(
      darkBackground ? 0x0f172a : 0xf8fafc,
    );
  }, [darkBackground]);

  useEffect(() => {
    if (!selectedModel || !containerRef.current) return;

    const container = containerRef.current;
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
          const neutralView = selectedModel.neutral_view;

          camera.position.set(
            neutralView.cameraPosition.x,
            neutralView.cameraPosition.y,
            neutralView.cameraPosition.z,
          );

          controls.target.set(
            neutralView.target.x,
            neutralView.target.y,
            neutralView.target.z,
          );

          camera.lookAt(controls.target);
          camera.updateMatrixWorld();
          controls.update();
        } else {
          centerCamera(model);
        }

        api.getAnnotations(selectedModel.id)
          .then(async (rows) => {
            clearMarkers();

            const loaded: Annotation[] =
              rows.map(fromDbAnnotation);

            setAnnotations(loaded);

            for (const annotation of loaded) {
              const hadCachedGeometry =
                Boolean(
                  annotation.projectedMask
                    ?.cachedGeometry
                    ?.positions
                    ?.length,
                );

              createAnnotationVisual(annotation);

              const generatedCachedGeometry =
                annotation.projectedMask
                  ?.cachedGeometry;

              const needsCachePersistence =
                annotation.id !== undefined &&
                !hadCachedGeometry &&
                Boolean(
                  generatedCachedGeometry
                    ?.positions
                    ?.length,
                );

              if (!needsCachePersistence) {
                continue;
              }

              try {
                await api.updateAnnotation(
                  annotation.id!,
                  createPayload(annotation),
                );

                console.log(
                  `Saved projected geometry cache for annotation ${annotation.id}`,
                );
              } catch (error) {
                console.error(
                  `Failed to save projected geometry cache for annotation ${annotation.id}:`,
                  error,
                );
              }
            }
          })
          .catch((error) =>
            console.error(
              'Failed to load annotations:',
              error,
            ),
          );

        api.getVideos()
          .then((vids: LinkedVideo[]) => setModelVideos(vids.filter((v) => v.annotation_id != null)))
          .catch((err) => console.error('Failed to load videos:', err));

        if (!selectedModel.thumbnail_path) {
          requestAnimationFrame(() => {
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
    const mouse = new THREE.Vector2();

    const getModelHit = (event: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(sourceMeshesRef.current, false)[0];
    };

    const handleClick = (event: MouseEvent) => {
      if (drawModeRef.current || regionModeRef.current) return;

      if (addModeRef.current) {
        const hit = getModelHit(event);
        if (!hit) return;
        pendingPointRef.current = hit.point.clone();
        setLabel('');
        setDescription('');
        setFormOpen(true);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObjects(markersRef.current, true);
      const accepted = hits.find((hit) => {
        const marker = hit.object as THREE.Mesh;
        const canvas = marker.userData.maskCanvas as HTMLCanvasElement | undefined;
        if (!canvas) return true;
        return Boolean(hit.uv && maskContainsUv(canvas, hit.uv));
      });

      if (!accepted) return;
      const marker = accepted.object as THREE.Mesh;
      const annotation = marker.userData.annotation as Annotation;
      if (!annotation) return;

      setPopupAnnotation(annotation);
      setIsolateSelected(true);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!drawModeRef.current && !regionModeRef.current) return;
      isDrawingRef.current = true;
      controls.enabled = false;
      currentWorldPointsRef.current = [];
      currentScreenPointsRef.current = [];
      currentMeshHitsRef.current = [];
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

      if (regionModeRef.current) {
        setIsGeneratingRegion(true);
        setTimeout(() => {
          finishProjectedAnnotation('fill');
          setIsGeneratingRegion(false);
        }, 30);
      } else {
        finishProjectedAnnotation('stroke');
      }
    };

    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      controls.update();
      //clampCameraOutsideModel();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      clearMarkers();
      clearPendingObjects();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [selectedModel]);

  useEffect(() => {
    setAnnotationVisibility(popupAnnotation);
  }, [annotationsVisible, isolateSelected, popupAnnotation]);

  function centerCamera(object: THREE.Object3D) {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());

    modelCenterRef.current.copy(sphere.center);
    modelRadiusRef.current = sphere.radius;

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

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const screenPoint = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    const previous = currentScreenPointsRef.current.at(-1);
    if (previous && Math.hypot(screenPoint.x - previous.x, screenPoint.y - previous.y) < 0.003) {
      return;
    }

    const hit = getModelHit(event);
    if (!hit) return;

    const mesh = hit.object as THREE.Mesh;
    currentScreenPointsRef.current.push(screenPoint);
    currentWorldPointsRef.current.push(hit.point.clone());
    currentMeshHitsRef.current.push(mesh.userData.viewerMeshIndex as number);
    setRegionBoundaryPreview([...currentScreenPointsRef.current]);
  }

  function finishProjectedAnnotation(mode: 'stroke' | 'fill') {
    const screenPoints = simplifyScreenPoints(currentScreenPointsRef.current);
    const worldPoints = currentWorldPointsRef.current;
    setRegionBoundaryPreview([]);

    if (
      screenPoints.length < (mode === 'fill' ? 4 : 2) ||
      worldPoints.length < 2 ||
      !cameraRef.current
    ) {
      clearPendingObjects();
      setDrawMode(false);
      setRegionMode(false);
      return;
    }

    const meshIndex = getDominantMeshIndex(currentMeshHitsRef.current);
    const projectedMask = buildProjectedMaskData(screenPoints, worldPoints, meshIndex, mode);
    if (!projectedMask) {
      alert('Could not project this annotation. Try drawing a smaller region on one visible surface.');
      setDrawMode(false);
      setRegionMode(false);
      return;
    }

    const annotation: Annotation = {
      label: '',
      description: '',
      color: mode === 'fill' ? '#22d3ee' : '#facc15',
      kind: mode === 'fill' ? 'projectedRegion' : 'projectedDraw',
      position: projectedMask.position,
      projectedMask,
      view: getViewData(),
    };

    pendingAnnotationRef.current = annotation;
    clearPendingObjects();
    const preview = createProjectedVisual(annotation);
    if (!preview) {
      pendingAnnotationRef.current = null;
      alert('The projected annotation could not be created on this surface.');
      setDrawMode(false);
      setRegionMode(false);
      return;
    }

    pendingObjectsRef.current = [preview];
    setLabel('');
    setDescription('');
    setColor(annotation.color ?? '#22d3ee');
    setFormOpen(true);
    setDrawMode(false);
    setRegionMode(false);
  }

  function getDominantMeshIndex(indices: number[]) {
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

  function buildProjectedMaskData(
    screenPoints: ScreenPoint[],
    worldPoints: THREE.Vector3[],
    meshIndex: number,
    mode: 'stroke' | 'fill',
  ): ProjectedMaskData | null {
    if (!cameraRef.current) return null;

    const camera = cameraRef.current;
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
    const baseWidth = Math.max(maxRight - minRight, getMarkerSize() * 2);
    const baseHeight = Math.max(maxUp - minUp, getMarkerSize() * 2);
    const padding = mode === 'fill' ? 1.08 : 1.3;
    const width = baseWidth * padding;
    const height = baseHeight * padding;
    const depth = Math.max(width, height) * 0.75;

    const adjustedCenter = center
      .clone()
      .addScaledVector(right, (minRight + maxRight) * 0.5)
      .addScaledVector(up, (minUp + maxUp) * 0.5)
      .addScaledVector(forward, -getMarkerSize() * 0.05);

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
      if (projected) markersRef.current.push(projected);
      return;
    }
    if (annotation.kind === 'draw' || annotation.kind === 'region') {
      createLegacyVisual(annotation);
      return;
    }
    createPointMarker(annotation);
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

  function getCenterOfPoints(points: THREE.Vector3[]) {
    if (points.length === 0) return new THREE.Vector3();
    return points
      .reduce((sum, point) => sum.add(point), new THREE.Vector3())
      .divideScalar(points.length);
  }

  function vectorToPoint(vector: THREE.Vector3): DrawPoint {
    return { x: vector.x, y: vector.y, z: vector.z };
  }

  async function saveAnnotation() {
    if (!selectedModel) return;
    const cleanLabel = label.trim();
    const cleanDescription = description.trim();
    if (!cleanLabel) {
      alert('Please enter a label.');
      return;
    }

    if (editingAnnotationRef.current) {
      const updated = {
        ...editingAnnotationRef.current,
        label: cleanLabel,
        description: cleanDescription,
        color:
          editingAnnotationRef.current.kind === 'projectedRegion'
            ? color
            : editingAnnotationRef.current.color,
      };
      const savedRow = await api.updateAnnotation(updated.id!, createPayload(updated));
      const saved = fromDbAnnotation(savedRow);
      markersRef.current.forEach((marker) => {
        if (marker.userData.annotation?.id !== saved.id) {
          return;
        }

        marker.userData.annotation = saved;

        if (
          saved.kind === 'projectedRegion' &&
          marker.material instanceof THREE.MeshBasicMaterial
        ) {
          marker.material.color.set(saved.color ?? '#22d3ee');
          marker.material.needsUpdate = true;
        }
      });
      setAnnotations((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
      editingAnnotationRef.current = null;
      setFormOpen(false);
      setPopupAnnotation(saved);
      return;
    }

    let annotation: Annotation;
    if (pendingAnnotationRef.current) {
      annotation = {
        ...pendingAnnotationRef.current,
        label: cleanLabel,
        description: cleanDescription,
        color:
          pendingAnnotationRef.current.kind === 'projectedRegion'
            ? color
            : pendingAnnotationRef.current.color,
      };
    } else {
      if (!pendingPointRef.current) return;
      annotation = {
        label: cleanLabel,
        description: cleanDescription,
        kind: 'point',
        position: vectorToPoint(pendingPointRef.current),
        view: getViewData(),
      };
    }

    try {
      const savedRow = await api.createAnnotation(selectedModel.id, createPayload(annotation));
      const saved = fromDbAnnotation(savedRow);

      if (pendingAnnotationRef.current) {
        pendingObjectsRef.current.forEach((object) => {
          object.userData.annotation = saved;

          if (
            saved.kind === 'projectedRegion' &&
            object.material instanceof THREE.MeshBasicMaterial
          ) {
            object.material.color.set(saved.color ?? '#22d3ee');
            object.material.needsUpdate = true;
          }

          markersRef.current.push(object);
        });

        pendingObjectsRef.current = [];
        pendingAnnotationRef.current = null;
      } else {
        createPointMarker(saved);
        pendingPointRef.current = null;
        setAddMode(false);
      }

      setAnnotations((previous) => [...previous, saved]);
      setPopupAnnotation(saved);
      setFormOpen(false);
    } catch (error) {
      console.error('Failed to save annotation:', error);
      alert('Failed to save annotation.');
    }
  }

  function createPayload(annotation: Annotation) {
    return {
      annotation_type: toDbAnnotationType(annotation.kind),
      label: annotation.label,
      description: annotation.description,
      color: annotation.color ?? null,
      annotation_data: {
        position: annotation.position,
        drawPoints: annotation.drawPoints,
        regionPlane: annotation.regionPlane,
        regionTriangles: annotation.regionTriangles,
        projectedMask: annotation.projectedMask,
        view: annotation.view,
      },
    };
  }

  async function deleteSelectedAnnotation() {
    const annotation = popupAnnotation;
    if (!annotation) return;

    if (annotation.id) {
      try {
        await api.deleteAnnotation(annotation.id);
      } catch (error) {
        console.error('Failed to delete annotation:', error);
        alert('Failed to delete annotation.');
        return;
      }
    }

    const related = markersRef.current.filter(
      (marker) => marker.userData.annotation?.id === annotation.id,
    );
    related.forEach(disposeMarker);
    markersRef.current = markersRef.current.filter(
      (marker) => marker.userData.annotation?.id !== annotation.id,
    );
    setAnnotations((previous) => previous.filter((item) => item.id !== annotation.id));
    setPopupAnnotation(null);
  }

  function editSelectedAnnotation() {
    if (!popupAnnotation) return;

    editingAnnotationRef.current = popupAnnotation;

    setLabel(popupAnnotation.label);
    setDescription(popupAnnotation.description);
    setColor(
      popupAnnotation.color ??
      (popupAnnotation.kind === 'projectedRegion'
        ? '#22d3ee'
        : '#facc15'),
    );

    setPopupAnnotation(null);
    setFormOpen(true);
  }

  function focusAnnotation(annotation: Annotation) {
    if (!cameraRef.current || !controlsRef.current) return;
    const position = new THREE.Vector3(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z,
    );
    controlsRef.current.target.copy(position);

    const direction = annotation.view
      ? new THREE.Vector3(annotation.view.x, annotation.view.y, annotation.view.z)
      : cameraRef.current.position.clone().sub(position).normalize();
    const distance = annotation.view?.distance || 1;
    cameraRef.current.position.copy(position.clone().add(direction.multiplyScalar(distance)));
    cameraRef.current.lookAt(position);
    controlsRef.current.update();

    setPopupAnnotation(annotation);
    setIsolateSelected(true);
    controlsRef.current.target.copy(modelCenterRef.current);
    cameraRef.current.lookAt(modelCenterRef.current);
    controlsRef.current.update();
  }

  function cancelForm() {
    setFormOpen(false);
    setAddMode(false);
    pendingPointRef.current = null;
    pendingAnnotationRef.current = null;
    clearPendingObjects();
  }

  function currentPendingTitle() {
    if (!pendingAnnotationRef.current) return 'Add Annotation';
    return pendingAnnotationRef.current.kind === 'projectedRegion'
      ? 'Add Projected Region'
      : 'Add Projected Highlight';
  }

  function currentModeText() {
    if (regionMode) return 'Projected Region Fill';
    if (drawMode) return 'Projected Highlight';
    if (addMode) return 'Add Annotation';
    return 'View';
  }

  function setAnnotationVisibility(annotation: Annotation | null) {
    markersRef.current.forEach((marker) => {
      const isSelected = Boolean(
        annotation && marker.userData.annotation?.id === annotation.id,
      );
      if (!annotationsVisible) marker.visible = isSelected;
      else if (isolateSelected && annotation) marker.visible = isSelected;
      else marker.visible = true;
    });
  }

  function getCurrentNeutralView() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) {
      return null;
    }

    return {
      cameraPosition: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
    };
  }

  async function saveNeutralView() {
    if (!selectedModel) return;

    const neutralView = getCurrentNeutralView();

    if (!neutralView) {
      return;
    }

    try {
      const updatedModel =
        await api.saveNeutralView(
          selectedModel.id,
          neutralView,
        );

      setSelectedModel(updatedModel);

      alert(
        selectedModel.neutral_view
          ? 'Neutral view updated.'
          : 'Neutral view saved.',
      );
    } catch (error) {
      console.error(
        'Failed to save neutral view:',
        error,
      );

      alert('Failed to save neutral view.');
    }
  }

  function returnToNeutralView() {
    const neutralView =
      selectedModel?.neutral_view;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (
      !neutralView ||
      !camera ||
      !controls
    ) {
      return;
    }

    camera.position.set(
      neutralView.cameraPosition.x,
      neutralView.cameraPosition.y,
      neutralView.cameraPosition.z,
    );

    controls.target.set(
      neutralView.target.x,
      neutralView.target.y,
      neutralView.target.z,
    );

    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    controls.update();
  }

  const previewPolyline = regionBoundaryPreview
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(' ');

  return (
    <div
      ref={viewerRef}
      className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50"
    >
      <div ref={containerRef} className="absolute inset-0" />

      <ViewerInstructions
        modeText={currentModeText()}
        drawMode={drawMode}
        regionMode={regionMode}
      />

      <ViewerToolbar
        role={role}
        addMode={addMode}
        drawMode={drawMode}
        regionMode={regionMode}
        annotationsVisible={annotationsVisible}
        hasNeutralView={Boolean(
          selectedModel?.neutral_view
        )}
        onToggleAdd={() => {
          setAddMode((previous) => !previous);
          setDrawMode(false);
          setRegionMode(false);
        }}
        onToggleDraw={() => {
          setDrawMode((previous) => !previous);
          setAddMode(false);
          setRegionMode(false);
        }}
        onToggleRegion={() => {
          setRegionMode((previous) => !previous);
          setAddMode(false);
          setDrawMode(false);
        }}
        onToggleAnnotations={() => {
          setAnnotationsVisible(
            (previous) => !previous
          );
          setPopupAnnotation(null);
          setIsolateSelected(false);
        }}
        onSaveNeutralView={saveNeutralView}
        onReturnToNeutralView={
          returnToNeutralView
        }
        darkBackground={darkBackground}
        onToggleBackground={() =>
          setDarkBackground((previous) => !previous)
        }
      />

      {(regionMode || drawMode) && regionBoundaryPreview.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={previewPolyline}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="0.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <AnnotationListPanel
        boundaryRef={viewerRef}
        controlsRef={controlsRef}
        annotations={annotations}
        selectedAnnotation={popupAnnotation}
        open={annotationsPanelOpen}
        modelTitle={selectedModel?.title ?? 'Model'}
        onToggleOpen={() => setAnnotationsPanelOpen((open) => !open)}
        onSelect={focusAnnotation}
      />

      {popupAnnotation && (
        <AnnotationDetailsPanel
          boundaryRef={viewerRef}
          controlsRef={controlsRef}
          annotation={popupAnnotation}
          role={role}
          linkedVideo={modelVideos.find((v) => v.annotation_id === popupAnnotation.id) || null}
          onPlayVideo={(video) => setPlayingVideo(video)}
          onEdit={editSelectedAnnotation}
          onDelete={deleteSelectedAnnotation}
          onClose={() => {
            setPopupAnnotation(null);
            setIsolateSelected(false);
          }}
        />
      )}

      {playingVideo && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 text-sm">{playingVideo.title}</h2>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                Close
              </button>
            </div>
            <video
              src={`http://localhost:5000${playingVideo.video_path}`}
              controls
              autoPlay
              className="w-full"
            />
          </div>
        </div>
      )}

      {isGeneratingRegion && <RegionGeneratingOverlay />}

      {formOpen && (
        <AnnotationFormModal
          title={currentPendingTitle()}
          label={label}
          description={description}
          color={color}
          showColorPicker={
            editingAnnotationRef.current?.kind === 'projectedRegion' ||
            pendingAnnotationRef.current?.kind === 'projectedRegion'
          }
          onLabelChange={setLabel}
          onDescriptionChange={setDescription}
          onColorChange={setColor}
          onCancel={cancelForm}
          onSave={saveAnnotation}
        />
      )}
    </div>
  );
}
