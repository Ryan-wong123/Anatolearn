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
import VideoPlayerModal from '../components/viewer/VideoPlayerModal';
import type {
  Annotation,
  LinkedVideo,
  ModelRecord,
  ScreenPoint,
} from '../components/viewer/types';
import {
  maskContainsUv,
  simplifyScreenPoints,
} from '../components/viewer/projectedMask';
import { createAnnotationVisualController } from '../components/viewer/annotationVisuals';
import {
  fromDbAnnotation,
  toDbAnnotationType,
} from '../components/viewer/annotationMapping';
import {
  buildProjectedMaskData,
  getDominantMeshIndex,
  vectorToPoint,
} from '../components/viewer/projectedMaskData';

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
  const hotspotsRef = useRef<THREE.Sprite[]>([]);
  const annotationHitTargetsRef = useRef<THREE.Mesh[]>([]);
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
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);
  const [modelVideos, setModelVideos] = useState<LinkedVideo[]>([]);
  const [playingVideo, setPlayingVideo] = useState<LinkedVideo | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#22d3ee');
  const [opacity, setOpacity] = useState(0.24);
  const [isGeneratingRegion, setIsGeneratingRegion] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const annotationsVisibleRef = useRef(annotationsVisible);
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
            clearAnnotationHitTargets();
            clearMarkers();
            clearHotspots();
            const loaded: Annotation[] =
              rows.map(fromDbAnnotation);

            setAnnotations(loaded);

            for (
              let index = 0;
              index < loaded.length;
              index += 1
            ) {
              const annotation = loaded[index];

              const hadCachedGeometry =
                Boolean(
                  annotation.projectedMask
                    ?.cachedGeometry
                    ?.positions
                    ?.length,
                );

              createAnnotationVisual(annotation);

              createAnnotationHotspot(
                annotation,
                index + 1,
              );

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
    renderer.domElement.addEventListener(
      'pointermove',
      handleAnnotationHover,
    );
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
      renderer.domElement.removeEventListener(
        'pointermove',
        handleAnnotationHover,
      );
      window.removeEventListener('resize', handleResize);
      clearAnnotationHitTargets();
      clearMarkers();
      clearHotspots();
      clearPendingObjects();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [selectedModel]);

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

  function clampCameraOutsideModel() {
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!camera || !controls) return;

    const center = modelCenterRef.current;
    const radius = modelRadiusRef.current;

    if (radius <= 0) return;

    const offset = camera.position
      .clone()
      .sub(center);

    const distance = offset.length();
    const minimumDistance = radius * 1.08;

    if (distance >= minimumDistance) return;

    if (distance === 0) {
      offset.set(0, 0, 1);
    } else {
      offset.normalize();
    }

    camera.position.copy(
      center.clone().addScaledVector(
        offset,
        minimumDistance,
      ),
    );

    /*
    * Keep OrbitControls rotating around the actual model centre.
    */
    controls.target.copy(center);

    camera.lookAt(center);
    camera.updateMatrixWorld();
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
    const projectedMask = buildProjectedMaskData(
      cameraRef.current,
      getMarkerSize(),
      screenPoints,
      worldPoints,
      meshIndex,
      mode,
    );

    const annotation: Annotation = {
      label: '',
      description: '',
      color: mode === 'fill' ? '#22d3ee' : '#facc15',
      opacity: mode === 'fill' ? 0.24 : 0.32,
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
    setOpacity(annotation.opacity ?? (mode === 'fill' ? 0.24 : 0.32));
    setFormOpen(true);
    setDrawMode(false);
    setRegionMode(false);
  }

  const {
    createProjectedVisual,
    createPointMarker,
    createAnnotationHotspot,
    createAnnotationHitTarget,
    handleAnnotationHover,
    clearHotspots,
    createAnnotationVisual,
    disposeMarker,
    clearPendingObjects,
    clearMarkers,
    clearAnnotationHitTargets,
  } = createAnnotationVisualController({
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
  });

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
        opacity:
          editingAnnotationRef.current.kind === 'projectedRegion' ||
          editingAnnotationRef.current.kind === 'projectedDraw'
            ? opacity
            : editingAnnotationRef.current.opacity,
      };
      const savedRow = await api.updateAnnotation(updated.id!, createPayload(updated));
      const saved = fromDbAnnotation(savedRow);
      markersRef.current.forEach((marker) => {
        if (marker.userData.annotation?.id !== saved.id) {
          return;
        }

        marker.userData.annotation = saved;

        if (marker.material instanceof THREE.MeshBasicMaterial) {
          if (saved.kind === 'projectedRegion') {
            marker.material.color.set(saved.color ?? '#22d3ee');
          }

          if (
            saved.kind === 'projectedRegion' ||
            saved.kind === 'projectedDraw'
          ) {
            marker.material.opacity =
              saved.opacity ??
              (saved.kind === 'projectedRegion' ? 0.24 : 0.32);
          }

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
        opacity,
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

          if (object.material instanceof THREE.MeshBasicMaterial) {
            if (saved.kind === 'projectedRegion') {
              object.material.color.set(saved.color ?? '#22d3ee');
            }

            if (
              saved.kind === 'projectedRegion' ||
              saved.kind === 'projectedDraw'
            ) {
              object.material.opacity =
                saved.opacity ??
                (saved.kind === 'projectedRegion' ? 0.24 : 0.32);
            }

            object.material.needsUpdate = true;
          }

          markersRef.current.push(object);
          createAnnotationHitTarget(saved, object);
        });

        pendingObjectsRef.current = [];
        pendingAnnotationRef.current = null;
      } else {
        createPointMarker(saved);
        pendingPointRef.current = null;
        setAddMode(false);
      }

      createAnnotationHotspot(
        saved,
        annotations.length + 1,
      );
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
        opacity: annotation.opacity,
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

    // Remove invisible hover targets belonging to this annotation.
    annotationHitTargetsRef.current =
      annotationHitTargetsRef.current.filter((hitTarget) => {
        const belongsToDeletedAnnotation =
          hitTarget.userData.annotation?.id === annotation.id;

        if (belongsToDeletedAnnotation) {
          hitTarget.removeFromParent();

          const materials = Array.isArray(hitTarget.material)
            ? hitTarget.material
            : [hitTarget.material];

          materials.forEach((material) => {
            material.dispose();
          });

          // Do NOT dispose geometry here.
          // It is shared with the annotation visual.
        }

        return !belongsToDeletedAnnotation;
      });

    // Remove the actual annotation visual.
    const relatedMarkers = markersRef.current.filter(
      (marker) =>
        marker.userData.annotation?.id === annotation.id,
    );

    relatedMarkers.forEach(disposeMarker);

    markersRef.current = markersRef.current.filter(
      (marker) =>
        marker.userData.annotation?.id !== annotation.id,
    );

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
    setIsolateSelected(false);
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

    setOpacity(
      popupAnnotation.opacity ??
      (popupAnnotation.kind === 'projectedRegion' ? 0.24 : 0.32),
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

  function setAnnotationVisibility(
    selectedAnnotation: Annotation | null,
    hoveredAnnotation: Annotation | null,
  ) {

    markersRef.current.forEach((marker) => {
      const annotation =
        marker.userData.annotation as
          | Annotation
          | undefined;

      const isSelected = Boolean(
        selectedAnnotation &&
        annotation?.id === selectedAnnotation.id,
      );

      const isHovered = Boolean(
        hoveredAnnotation &&
        annotation?.id === hoveredAnnotation.id,
      );

      marker.visible =
        isSelected || isHovered;
    });

    hotspotsRef.current.forEach((hotspot) => {
      const annotation =
        hotspot.userData.annotation as
          | Annotation
          | undefined;

      const isHovered =
        Boolean(
          hoveredAnnotation &&
          annotation?.id ===
            hoveredAnnotation.id,
        );

      const isSelected =
        Boolean(
          selectedAnnotation &&
          annotation?.id ===
            selectedAnnotation.id,
        );

      hotspot.visible =
        annotationsVisible &&
        !isHovered &&
        !isSelected;
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
          setHoveredAnnotation(null);
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
        onHover={setHoveredAnnotation}
        onHoverEnd={() => setHoveredAnnotation(null)}
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
        <VideoPlayerModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {isGeneratingRegion && <RegionGeneratingOverlay />}

      {formOpen && (
        <AnnotationFormModal
          title={currentPendingTitle()}
          label={label}
          description={description}
          color={color}
          opacity={opacity}
          showColorPicker={
            editingAnnotationRef.current?.kind === 'projectedRegion' ||
            pendingAnnotationRef.current?.kind === 'projectedRegion'
          }
          showOpacitySlider={
            editingAnnotationRef.current?.kind === 'projectedRegion' ||
            editingAnnotationRef.current?.kind === 'projectedDraw' ||
            pendingAnnotationRef.current?.kind === 'projectedRegion' ||
            pendingAnnotationRef.current?.kind === 'projectedDraw'
          }
          onLabelChange={setLabel}
          onDescriptionChange={setDescription}
          onColorChange={setColor}
          onOpacityChange={setOpacity}
          onCancel={cancelForm}
          onSave={saveAnnotation}
        />
      )}
    </div>
  );
}
