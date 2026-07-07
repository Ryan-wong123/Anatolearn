import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';
import { useParams } from 'react-router-dom';

type AnnotationKind = 'point' | 'draw' | 'region';

interface DrawPoint {
  x: number;
  y: number;
  z: number;
}

interface RegionPlane {
  right: DrawPoint;
  up: DrawPoint;
  normal: DrawPoint;
}

interface Annotation {
  id?: number;
  label: string;
  description: string;
  kind: AnnotationKind;
  position: { x: number; y: number; z: number };
  drawPoints?: DrawPoint[];
  regionPlane?: RegionPlane;
  regionTriangles?: DrawPoint[];
  view?: { x: number; y: number; z: number; distance: number };
}

interface ModelRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
}

function toDbAnnotationType(
  kind: AnnotationKind
): 'point' | 'highlight' | 'region_fill' {
  if (kind === 'point') return 'point';
  if (kind === 'draw') return 'highlight';
  return 'region_fill';
}

function fromDbAnnotation(row: any): Annotation {
  return {
    id: row.id,
    label: row.label,
    description: row.description || '',
    kind:
      row.annotation_type === 'point'
        ? 'point'
        : row.annotation_type === 'highlight'
          ? 'draw'
          : 'region',
    position: row.annotation_data.position,
    drawPoints: row.annotation_data.drawPoints,
    regionPlane: row.annotation_data.regionPlane,
    regionTriangles: row.annotation_data.regionTriangles,
    view: row.annotation_data.view,
  };
}


export default function Viewer() {
  const { role } = useAppContext();
  const { modelId } = useParams();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  const markersRef = useRef<THREE.Mesh[]>([]);
  const selectedMarkerRef = useRef<THREE.Mesh | null>(null);
  const pendingPointRef = useRef<THREE.Vector3 | null>(null);
  const pendingDrawAnnotationRef = useRef<Annotation | null>(null);
  const editingAnnotationRef = useRef<Annotation | null>(null);
  const addModeRef = useRef(false);
  const drawModeRef = useRef(false);
  const regionModeRef = useRef(false);
  const isDrawingRef = useRef(false);

  const currentDrawPointsRef = useRef<THREE.Vector3[]>([]);
  const currentDrawObjectsRef = useRef<THREE.Mesh[]>([]);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [regionMode, setRegionMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [popupAnnotation, setPopupAnnotation] = useState<Annotation | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isGeneratingRegion, setIsGeneratingRegion] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [viewerPopupPosition, setViewerPopupPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    regionModeRef.current = regionMode;
  }, [regionMode]);

  const [selectedModel, setSelectedModel] = useState<ModelRecord | null>(null);

  useEffect(() => {
    if (!modelId) return;

    api.getModel(Number(modelId))
      .then(setSelectedModel)
      .catch(console.error);
  }, [modelId]);

  useEffect(() => {
    if (!selectedModel) return;
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 2));

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 5);
    scene.add(light);

    const loader = new GLTFLoader();
    
    loader.load(
      selectedModel.file_path,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        scene.add(model);
        centerCamera(model);
        api.getAnnotations(selectedModel.id)
          .then((rows) => {
            clearMarkers();

            const loaded = rows.map(fromDbAnnotation);
            setAnnotations(loaded);

            loaded.forEach((annotation: Annotation) => {
              createAnnotationVisual(annotation);
            });
          })
          .catch((err) => console.error('Failed to load annotations:', err));
        if (!selectedModel.thumbnail_path && rendererRef.current && cameraRef.current) {
          requestAnimationFrame(() => {
            rendererRef.current?.render(scene, cameraRef.current!);

            const thumbnailDataUrl = rendererRef.current?.domElement.toDataURL('image/png');

            if (!thumbnailDataUrl) return;

            api.saveModelThumbnail(selectedModel.id, thumbnailDataUrl)
              .catch((err) => console.error('Failed to save model thumbnail:', err));
          });
        }
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            console.log(
              'Mesh:',
              mesh.name || '(unnamed)',
              'Vertices:',
              mesh.geometry.attributes.position.count
            );
          }
        });
      },
      undefined,
      (error) => console.error('Model loading failed:', error)
    );

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (drawModeRef.current || regionModeRef.current) return;
      if (!modelRef.current || !cameraRef.current || !rendererRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      if (addModeRef.current) {
        const hits = raycaster.intersectObject(modelRef.current, true);
        if (hits.length === 0) return;

        pendingPointRef.current = hits[0].point.clone();
        setLabel('');
        setDescription('');
        setFormOpen(true);
        return;
      }

      const markerHits = raycaster.intersectObjects(markersRef.current);
      if (markerHits.length === 0) return;

      const marker = markerHits[0].object as THREE.Mesh;
      const annotation = marker.userData.annotation as Annotation;

      selectedMarkerRef.current = marker;
      setPopupAnnotation(annotation);
      setIsolateSelected(true);

      setViewerPopupPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!drawModeRef.current && !regionModeRef.current) return;
      if (!modelRef.current || !cameraRef.current || !rendererRef.current) return;

      isDrawingRef.current = true;
      currentDrawPointsRef.current = [];
      currentDrawObjectsRef.current = [];

      controls.enabled = false;
      addDrawPointFromEvent(event, raycaster, mouse);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current) return;
      addDrawPointFromEvent(event, raycaster, mouse);
    };

    const handlePointerUp = () => {
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      controls.enabled = true;

      if (regionModeRef.current) {
        setIsGeneratingRegion(true);

        setTimeout(() => {
          finishRegionAnnotation();
          setIsGeneratingRegion(false);
        }, 50);
      } else {
        finishDrawAnnotation();
      }
    };

    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
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

      controls.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [selectedModel]);

  useEffect(() => {
    setAnnotationVisibility(popupAnnotation);
  }, [annotationsVisible, isolateSelected, popupAnnotation]);

  function centerCamera(object: THREE.Object3D) {
    if (!cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    controlsRef.current.target.copy(center);

    cameraRef.current.position.set(
      center.x,
      center.y + maxSize * 0.4,
      center.z + maxSize * 1.5
    );

    cameraRef.current.lookAt(center);
    controlsRef.current.update();
  }

  function getMarkerSize() {
    if (!modelRef.current) return 0.1;

    const box = new THREE.Box3().setFromObject(modelRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    return maxSize * 0.015;
  }

  function getViewData() {
    if (!cameraRef.current || !controlsRef.current) return undefined;

    const viewDirection = cameraRef.current.position
      .clone()
      .sub(controlsRef.current.target)
      .normalize();

    const viewDistance = cameraRef.current.position.distanceTo(
      controlsRef.current.target
    );

    return {
      x: viewDirection.x,
      y: viewDirection.y,
      z: viewDirection.z,
      distance: viewDistance,
    };
  }

  function getRegionPlane(): RegionPlane {
    if (!cameraRef.current) {
      return {
        right: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      };
    }

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const normal = new THREE.Vector3();

    cameraRef.current.matrixWorld.extractBasis(right, up, normal);
    normal.multiplyScalar(-1).normalize();

    return {
      right: { x: right.x, y: right.y, z: right.z },
      up: { x: up.x, y: up.y, z: up.z },
      normal: { x: normal.x, y: normal.y, z: normal.z },
    };
  }

  function toVector3(point: DrawPoint) {
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  function createPointMarker(annotation: Annotation) {
    if (!sceneRef.current) return;

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(getMarkerSize(), 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xff1a00 })
    );

    marker.position.set(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z
    );

    marker.userData.annotation = annotation;

    sceneRef.current.add(marker);
    markersRef.current.push(marker);
  }

  function createSurfaceDot(
    point: THREE.Vector3,
    color: number,
    opacity: number,
    scale = 0.22,
    annotation?: Annotation
  ) {
    if (!sceneRef.current) return null;

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(getMarkerSize() * scale, 8, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );

    dot.position.copy(point);

    if (annotation) {
      dot.userData.annotation = annotation;
    }

    sceneRef.current.add(dot);
    return dot;
  }

  function createDrawDot(point: THREE.Vector3, annotation?: Annotation) {
    return createSurfaceDot(point, 0xffcc00, 0.4, 0.22, annotation);
  }

  function createBoundaryDot(point: THREE.Vector3) {
    return createSurfaceDot(point, 0x38bdf8, 0.55, 0.2);
  }

  function createRegionMesh(annotation: Annotation) {
    if (!sceneRef.current) return null;

    const trianglePoints =
      annotation.regionTriangles ??
      collectSurfaceRegionTriangles(annotation.drawPoints?.map(toVector3) ?? []);

      if (trianglePoints.length < 3) return null;

      const vertices: number[] = [];

      trianglePoints.forEach((point) => {
        vertices.push(point.x, point.y, point.z);
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      geometry.computeVertexNormals();

      const material = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.38,
        side: THREE.FrontSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.annotation = annotation;

      sceneRef.current.add(mesh);
      return mesh;
    }

    function collectSurfaceRegionTriangles(boundary: THREE.Vector3[]) {
      if (
        boundary.length < 3 ||
        !cameraRef.current ||
        !rendererRef.current ||
        !modelRef.current
      ) {
        return [];
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();

      const polygon = boundary.map((point) => {
        const p = worldToScreenPoint(point, rect.width, rect.height);
        return { x: p.x, y: p.y };
      });

      const xs = polygon.map((p) => p.x);
      const ys = polygon.map((p) => p.y);

      const minX = Math.max(0, Math.min(...xs));
      const maxX = Math.min(rect.width, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys));
      const maxY = Math.min(rect.height, Math.max(...ys));

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const selectedFaces = new Map<
        string,
        { mesh: THREE.Mesh; faceIndex: number }
      >();

      const step = 2;
      const maxFaces = 5000;

      for (let y = minY; y <= maxY; y += step) {
        for (let x = minX; x <= maxX; x += step) {
          if (selectedFaces.size >= maxFaces) break;

          if (!pointInPolygon({ x, y }, polygon)) continue;

          mouse.x = (x / rect.width) * 2 - 1;
          mouse.y = -(y / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, cameraRef.current);

          const hits = raycaster.intersectObject(modelRef.current, true);
          if (hits.length === 0) continue;

          const hit = hits[0];

          if (hit.faceIndex == null) continue;

          const mesh = hit.object as THREE.Mesh;
          if (!mesh.isMesh) continue;

          selectedFaces.set(`${mesh.uuid}-${hit.faceIndex}`, {
            mesh,
            faceIndex: hit.faceIndex,
          });
        }
      }

      const trianglePoints: DrawPoint[] = [];

      selectedFaces.forEach(({ mesh, faceIndex }) => {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const position = geometry.attributes.position;
        const index = geometry.index;

        if (!position) return;

        const getVertex = (i: number) => {
          const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
          return mesh.localToWorld(vertex);
        };

        let aIndex: number;
        let bIndex: number;
        let cIndex: number;

        if (index) {
          const base = faceIndex * 3;
          aIndex = index.getX(base);
          bIndex = index.getX(base + 1);
          cIndex = index.getX(base + 2);
        } else {
          const base = faceIndex * 3;
          aIndex = base;
          bIndex = base + 1;
          cIndex = base + 2;
        }

        const a = getVertex(aIndex);
        const b = getVertex(bIndex);
        const c = getVertex(cIndex);

        const normal = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
        const offset = normal.multiplyScalar(getMarkerSize() * 0.04);

        [a, b, c].forEach((point) => {
          const p = point.clone().add(offset);
          trianglePoints.push({ x: p.x, y: p.y, z: p.z });
        });
      });

      return trianglePoints;
    }

  function worldToScreenPoint(
    point: THREE.Vector3,
    width: number,
    height: number
  ) {
    if (!cameraRef.current) return { x: 0, y: 0, z: 0 };

    const projected = point.clone().project(cameraRef.current);

    return {
      x: ((projected.x + 1) / 2) * width,
      y: ((-projected.y + 1) / 2) * height,
      z: projected.z,
    };
  }

  function pointInPolygon(
    point: { x: number; y: number },
    polygon: { x: number; y: number }[]
  ) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  function createAnnotationVisual(annotation: Annotation) {
    if (annotation.kind === 'region') {
      const mesh = createRegionMesh(annotation);
      if (mesh) markersRef.current.push(mesh);
      return;
    }

    if (annotation.kind === 'draw' && annotation.drawPoints) {
      annotation.drawPoints.forEach((point) => {
        const dot = createDrawDot(
          new THREE.Vector3(point.x, point.y, point.z),
          annotation
        );

        if (dot) markersRef.current.push(dot);
      });

      return;
    }

    createPointMarker(annotation);
  }

  function addDrawPointFromEvent(
    event: PointerEvent,
    raycaster: THREE.Raycaster,
    mouse: THREE.Vector2
  ) {
    if (!modelRef.current || !cameraRef.current || !rendererRef.current) return;

    const rect = rendererRef.current.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cameraRef.current);

    const hits = raycaster.intersectObject(modelRef.current, true);
    if (hits.length === 0) return;

    const point = hits[0].point.clone();
    const lastPoint = currentDrawPointsRef.current.at(-1);

    if (lastPoint && lastPoint.distanceTo(point) < getMarkerSize() * 0.7) {
      return;
    }

    const dot = regionModeRef.current
      ? createBoundaryDot(point)
      : createDrawDot(point);

    if (!dot) return;

    currentDrawPointsRef.current.push(point);
    currentDrawObjectsRef.current.push(dot);
  }

  function finishDrawAnnotation() {
    if (currentDrawPointsRef.current.length < 2) {
      clearCurrentDraw();
      setDrawMode(false);
      return;
    }

    const drawPoints = currentDrawPointsRef.current.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
    }));

    const center = getCenterOfPoints(currentDrawPointsRef.current);

    const annotation: Annotation = {
      label: '',
      description: '',
      kind: 'draw',
      position: {
        x: center.x,
        y: center.y,
        z: center.z,
      },
      drawPoints,
      view: getViewData(),
    };

    pendingDrawAnnotationRef.current = annotation;

    setLabel('');
    setDescription('');
    setFormOpen(true);
    setDrawMode(false);
  }

  function finishRegionAnnotation() {
    if (currentDrawPointsRef.current.length < 4) {
      clearCurrentDraw();
      setRegionMode(false);
      return;
    }

    const boundaryPoints = currentDrawPointsRef.current.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
    }));

    const regionTriangles = collectSurfaceRegionTriangles(currentDrawPointsRef.current);

    if (regionTriangles.length < 3) {
      alert('Could not create surface-filled region. Try drawing a clearer closed boundary.');
      clearCurrentDraw();
      setRegionMode(false);
      return;
    }

    const center = getCenterOfPoints(currentDrawPointsRef.current);

    clearCurrentDraw();

    const annotation: Annotation = {
      label: '',
      description: '',
      kind: 'region',
      position: {
        x: center.x,
        y: center.y,
        z: center.z,
      },
      drawPoints: boundaryPoints,
      regionPlane: getRegionPlane(),
      regionTriangles,
      view: getViewData(),
    };

    const regionMesh = createRegionMesh(annotation);

    if (!regionMesh) {
      alert('Could not create filled region. Try drawing a simpler closed boundary.');
      setRegionMode(false);
      return;
    }

    pendingDrawAnnotationRef.current = annotation;
    currentDrawObjectsRef.current = [regionMesh];
    currentDrawPointsRef.current = boundaryPoints.map(toVector3);

    setLabel('');
    setDescription('');
    setFormOpen(true);
    setRegionMode(false);
  }

  function getCenterOfPoints(points: THREE.Vector3[]) {
    return points
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .divideScalar(points.length);
  }

  function clearCurrentDraw() {
    currentDrawObjectsRef.current.forEach((object) => {
      sceneRef.current?.remove(object);
      object.geometry.dispose();

      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        object.material.dispose();
      }
    });

    currentDrawPointsRef.current = [];
    currentDrawObjectsRef.current = [];
    pendingDrawAnnotationRef.current = null;
  }

  function clearMarkers() {
    if (!sceneRef.current) return;

    markersRef.current.forEach((marker) => {
      sceneRef.current?.remove(marker);
      marker.geometry.dispose();

      if (Array.isArray(marker.material)) {
        marker.material.forEach((m) => m.dispose());
      } else {
        marker.material.dispose();
      }
    });

    markersRef.current = [];
    selectedMarkerRef.current = null;
    setPopupAnnotation(null);
  }

  async function saveAnnotation() {
    if (!selectedModel) return;

    const cleanLabel = label.trim();
    const cleanDescription = description.trim();

    if (!cleanLabel) {
      alert('Please enter a label.');
      return;
    }

    let annotation: Annotation;
    if (editingAnnotationRef.current) {
      const original = editingAnnotationRef.current;

      const updatedAnnotation: Annotation = {
        ...original,
        label: cleanLabel,
        description: cleanDescription,
      };

      const payload = {
        annotation_type: toDbAnnotationType(updatedAnnotation.kind),
        label: updatedAnnotation.label,
        description: updatedAnnotation.description,
        color: null,
        annotation_data: {
          position: updatedAnnotation.position,
          drawPoints: updatedAnnotation.drawPoints,
          regionPlane: updatedAnnotation.regionPlane,
          regionTriangles: updatedAnnotation.regionTriangles,
          view: updatedAnnotation.view,
        },
      };

      const savedRow = await api.updateAnnotation(original.id!, payload);
      const savedAnnotation = fromDbAnnotation(savedRow);

      markersRef.current.forEach((marker) => {
        if (marker.userData.annotation?.id === savedAnnotation.id) {
          marker.userData.annotation = savedAnnotation;
        }
      });

      setAnnotations((prev) =>
        prev.map((a) => (a.id === savedAnnotation.id ? savedAnnotation : a))
      );

      editingAnnotationRef.current = null;
      setFormOpen(false);
      setPopupAnnotation(savedAnnotation);

      return;
    }
    if (pendingDrawAnnotationRef.current) {
      annotation = {
        ...pendingDrawAnnotationRef.current,
        label: cleanLabel,
        description: cleanDescription,
      };
    } else {
      if (!pendingPointRef.current) return;

      annotation = {
        label: cleanLabel,
        description: cleanDescription,
        kind: 'point',
        position: {
          x: pendingPointRef.current.x,
          y: pendingPointRef.current.y,
          z: pendingPointRef.current.z,
        },
        view: getViewData(),
      };
    }

    const payload = {
      annotation_type: toDbAnnotationType(annotation.kind),
      label: annotation.label,
      description: annotation.description,
      color: null,
      annotation_data: {
        position: annotation.position,
        drawPoints: annotation.drawPoints,
        regionPlane: annotation.regionPlane,
        regionTriangles: annotation.regionTriangles,
        view: annotation.view,
      },
    };

    try {
      const savedRow = annotation.id
        ? await api.updateAnnotation(annotation.id, payload)
        : await api.createAnnotation(selectedModel.id, payload);

      const savedAnnotation = fromDbAnnotation(savedRow);

      if (pendingDrawAnnotationRef.current) {
        currentDrawObjectsRef.current.forEach((object) => {
          object.userData.annotation = savedAnnotation;
          markersRef.current.push(object);
        });

        pendingDrawAnnotationRef.current = null;
        currentDrawPointsRef.current = [];
        currentDrawObjectsRef.current = [];
      } else {
        createPointMarker(savedAnnotation);
        pendingPointRef.current = null;
        setAddMode(false);
      }

      setAnnotations((prev) => {
        if (savedAnnotation.id) {
          return [
            ...prev.filter((a) => a.id !== savedAnnotation.id),
            savedAnnotation,
          ];
        }

        return [...prev, savedAnnotation];
      });

      setPopupAnnotation(savedAnnotation);
      setFormOpen(false);
    } catch (err) {
      console.error('Failed to save annotation:', err);
      alert('Failed to save annotation.');
    }
  }

  async function deleteSelectedAnnotation() {
    const selected = selectedMarkerRef.current;
    const annotation = popupAnnotation ?? selected?.userData.annotation;

    if (!annotation || !sceneRef.current) return;
    if (annotation.id) {
      try {
        await api.deleteAnnotation(annotation.id);
      } catch (err) {
        console.error('Failed to delete annotation:', err);
        alert('Failed to delete annotation.');
        return;
      }
    }
    const relatedMarkers = markersRef.current.filter(
      (marker) => marker.userData.annotation === annotation
    );

    relatedMarkers.forEach((marker) => {
      sceneRef.current?.remove(marker);
      marker.geometry.dispose();

      if (Array.isArray(marker.material)) {
        marker.material.forEach((m) => m.dispose());
      } else {
        marker.material.dispose();
      }
    });

    markersRef.current = markersRef.current.filter(
      (marker) => marker.userData.annotation !== annotation
    );

    selectedMarkerRef.current = null;

    setAnnotations((prev) => prev.filter((a) => a !== annotation));
    setPopupAnnotation(null);
    setViewerPopupPosition(null);
  }

  function editSelectedAnnotation() {
    if (!popupAnnotation) return;

    editingAnnotationRef.current = popupAnnotation;

    setLabel(popupAnnotation.label);
    setDescription(popupAnnotation.description);

    setPopupAnnotation(null);
    setViewerPopupPosition(null);
    setFormOpen(true);
  }

  function focusAnnotation(annotation: Annotation) {
    if (!cameraRef.current || !controlsRef.current) return;

    const pos = new THREE.Vector3(
      annotation.position.x,
      annotation.position.y,
      annotation.position.z
    );

    controlsRef.current.target.copy(pos);

    let direction: THREE.Vector3;

    if (annotation.view) {
      direction = new THREE.Vector3(
        annotation.view.x,
        annotation.view.y,
        annotation.view.z
      );
    } else {
      direction = cameraRef.current.position
        .clone()
        .sub(controlsRef.current.target)
        .normalize();
    }

    const distance = annotation.view?.distance || 1;

    cameraRef.current.position.copy(
      pos.clone().add(direction.multiplyScalar(distance))
    );

    cameraRef.current.lookAt(pos);
    controlsRef.current.update();

    const relatedMarker = markersRef.current.find(
      (marker) => marker.userData.annotation === annotation
    );

    selectedMarkerRef.current = relatedMarker ?? null;
    setPopupAnnotation(annotation);

    setIsolateSelected(true);

    if (rendererRef.current && cameraRef.current) {
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const screen = worldToScreenPoint(pos, rect.width, rect.height);

      setViewerPopupPosition({
        x: screen.x,
        y: screen.y,
      });
    }
  }

  function cancelForm() {
    setFormOpen(false);
    setAddMode(false);

    pendingPointRef.current = null;

    if (pendingDrawAnnotationRef.current) {
      clearCurrentDraw();
    }
  }

  function currentPendingTitle() {
    if (!pendingDrawAnnotationRef.current) return 'Add Annotation';
    if (pendingDrawAnnotationRef.current.kind === 'region') return 'Add Filled Region';
    return 'Add Highlight';
  }

  function currentModeText() {
    if (regionMode) return 'Region Fill';
    if (drawMode) return 'Draw Highlight';
    if (addMode) return 'Add Annotation';
    return 'View';
  }

  function setAnnotationVisibility(annotation: Annotation | null = null) {
    markersRef.current.forEach((marker) => {
      const isSelected = annotation && marker.userData.annotation === annotation;

      // If annotations are hidden, still show the selected one only
      if (!annotationsVisible) {
        marker.visible = Boolean(isSelected);
        return;
      }

      // If annotations are visible but isolated, show selected only
      if (isolateSelected && annotation) {
        marker.visible = Boolean(isSelected);
        return;
      }

      marker.visible = true;
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            3D Anatomy Viewer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View, navigate, annotate, and highlight anatomical 3D models.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {role === 'teacher' && (
            <>
              <button
                onClick={() => {
                  setAddMode((prev) => !prev);
                  setDrawMode(false);
                  setRegionMode(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  addMode
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {addMode ? 'Cancel Annotation' : 'Add Annotation'}
              </button>

              <button
                onClick={() => {
                  setDrawMode((prev) => !prev);
                  setAddMode(false);
                  setRegionMode(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  drawMode
                    ? 'bg-yellow-300 text-slate-900 hover:bg-yellow-400'
                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {drawMode ? 'Cancel Draw' : 'Draw Highlight'}
              </button>

              <button
                onClick={() => {
                  setRegionMode((prev) => !prev);
                  setAddMode(false);
                  setDrawMode(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  regionMode
                    ? 'bg-cyan-300 text-slate-900 hover:bg-cyan-400'
                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {regionMode ? 'Cancel Region' : 'Region Fill'}
              </button>
            </>
          )}

          <button
            onClick={() => {
              setAnnotationsVisible((prev) => !prev);
              setPopupAnnotation(null);
              setViewerPopupPosition(null);
              setIsolateSelected(false);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
          >
            {annotationsVisible ? 'Hide Annotations' : 'Show Annotations'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="relative bg-white rounded-xl border border-slate-200 overflow-hidden h-[650px]">
          <div ref={containerRef} className="w-full h-full" />

          <div className="absolute left-4 top-4 bg-white/90 rounded-xl border border-slate-200 p-3 text-sm text-slate-600 shadow-sm">
            <p>Left Mouse: Rotate</p>
            <p>Right Mouse: Pan</p>
            <p>Scroll: Zoom</p>
            <p className="mt-2 font-semibold text-slate-900">
              Mode: {currentModeText()}
            </p>
            {drawMode && (
              <p className="mt-1 text-yellow-700">
                Drag directly on the model to draw.
              </p>
            )}
            {regionMode && (
              <p className="mt-1 text-cyan-700">
                Draw a closed boundary to fill a region.
              </p>
            )}
          </div>
          {isGeneratingRegion && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20">
              <div className="bg-white rounded-xl border border-slate-200 px-6 py-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-cyan-500 animate-spin" />
                  <div>
                    <p className="font-semibold text-slate-800">
                      Generating filled region...
                    </p>
                    <p className="text-xs text-slate-500">
                      Processing surface geometry
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {popupAnnotation && viewerPopupPosition && (
            <div
              className="absolute z-30 w-72 bg-white rounded-xl border border-slate-200 p-4 shadow-xl"
              style={{
                left: Math.min(viewerPopupPosition.x + 16, 650),
                top: Math.max(viewerPopupPosition.y - 40, 16),
              }}
            >
              <h2 className="font-semibold text-slate-900 font-display">
                {popupAnnotation.label}
              </h2>

              <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">
                {popupAnnotation.kind === 'region'
                  ? 'Filled Region'
                  : popupAnnotation.kind === 'draw'
                    ? 'Highlight'
                    : 'Point Annotation'}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {popupAnnotation.description || 'No description.'}
              </p>

              <div className="mt-4 flex gap-2">
                {role === 'teacher' && (
                  <>
                    <button
                      onClick={editSelectedAnnotation}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      onClick={deleteSelectedAnnotation}
                      className="flex-1 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setPopupAnnotation(null);
                    setViewerPopupPosition(null);
                    setIsolateSelected(false);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900 font-display">
              Annotations
            </h2>

            <div className="mt-3 space-y-2">
              {annotations.length === 0 ? (
                <p className="text-sm text-slate-400">No annotations yet.</p>
              ) : (
                annotations.map((annotation, index) => (
                  <button
                    key={`${annotation.label}-${index}`}
                    onClick={() => focusAnnotation(annotation)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 transition-colors"
                  >
                    {index + 1}. {annotation.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display">
              {currentPendingTitle()}
            </h2>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Label
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Masseter muscle"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short explanation"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={cancelForm}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>

              <button
                onClick={saveAnnotation}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}