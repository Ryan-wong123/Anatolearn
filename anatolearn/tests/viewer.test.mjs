import { getModelFraming } from '../src/components/viewer/modelFraming.ts';
import { repositionAnnotation } from '../src/components/viewer/repositionAnnotation.ts';
import { getBasicAnnotationVisuals } from '../src/components/viewer/basicAnnotationVisuals.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDbAnnotation, toAnnotationPayload, applyAnnotationDraft, isAnnotationActive, createProjectedAnnotation } from '../src/components/viewer/annotationMapping.ts';
import { createDrawingSamples, hasRegionArea, normalizeDrawingPoint } from '../src/components/viewer/drawingSamples.ts';
import { bindViewerEvents } from '../src/components/viewer/bindViewerEvents.ts';
import { loadViewerAnnotations } from '../src/components/viewer/loadViewerAnnotations.ts';
import { toggleViewerMode, VIEWER_MODE_LABELS } from '../src/components/viewer/viewerMode.ts';
import { buildProjectedMaskData } from '../src/components/viewer/projectedMaskData.ts';
import { Vector3 } from 'three';

const position = { x: 1, y: 2, z: 3 };
const view = { x: 0, y: 0, z: 1, distance: 4 };
const projectedMask = {
  meshIndex: 2, position, orientation: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 }, maskPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  mode: 'fill', cachedGeometry: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], uvs: [0, 0, 1, 0, 0, 1] },
};

for (const kind of ['point', 'draw', 'region', 'projectedDraw', 'projectedRegion']) {
  test(`${kind} survives API JSON round trip with visual data intact`, () => {
    const original = {
      id: 7, kind, label: 'Biceps', description: 'Flexes the elbow', position, view,
      color: '#123456', opacity: 0.45,
      ...(kind === 'draw' ? { drawPoints: [position] } : {}),
      ...(kind === 'region' ? { regionTriangles: [position], regionPlane: { right: position, up: position, normal: position } } : {}),
      ...(kind.startsWith('projected') ? { projectedMask: { ...projectedMask, mode: kind === 'projectedDraw' ? 'stroke' : 'fill' } } : {}),
    };
    const payload = JSON.parse(JSON.stringify(toAnnotationPayload(original)));
    const loaded = fromDbAnnotation({ id: 7, ...payload });
    assert.equal(loaded.kind, kind);
    assert.deepEqual(JSON.parse(JSON.stringify(loaded)), original);
  });
}

test('legacy null annotation data has a safe origin and description', () => {
  const loaded = fromDbAnnotation({ id: 2, annotation_type: 'point', label: 'Legacy', description: null, color: null, annotation_data: null });
  assert.deepEqual(loaded.position, { x: 0, y: 0, z: 0 });
  assert.equal(loaded.description, '');
});

test('draft editing changes only fields supported by each annotation kind', () => {
  const draft = { label: ' Edited ', description: ' Trim me ', color: '#abcdef', opacity: 0.8 };
  for (const kind of ['point', 'draw', 'region', 'projectedDraw', 'projectedRegion']) {
    const original = { kind, label: 'Before', description: '', position, color: '#123456', opacity: 0.2 };
    const edited = applyAnnotationDraft(original, draft);
    assert.equal(edited.label, 'Edited');
    assert.equal(edited.description, 'Trim me');
    assert.equal(edited.color, kind === 'projectedRegion' ? '#abcdef' : '#123456');
    assert.equal(edited.opacity, kind.startsWith('projected') ? 0.8 : 0.2);
    assert.equal(original.label, 'Before');
    assert.equal(original.opacity, 0.2);
  }
});

test('projected regions and highlights retain their default colors', () => {
  for (const [annotation_type, color] of [['region_fill', '#22d3ee'], ['highlight', '#facc15']]) {
    assert.equal(fromDbAnnotation({ id: 1, annotation_type, label: '', description: '', color: null, annotation_data: { position, projectedMask } }).color, color);
  }
});

test('mode transitions switch directly and toggling the same tool returns to view', () => {
  for (const current of Object.keys(VIEWER_MODE_LABELS)) {
    for (const tool of ['point', 'highlight', 'region']) {
      assert.equal(toggleViewerMode(current, tool), current === tool ? 'view' : tool);
    }
  }
});

test('projection uses a camera snapshot without mutating inputs or losing mask/cache parameters', () => {
  const frame = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: -1 }, orientation: { x: 0, y: 0, z: 0 } };
  const screen = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const world = [new Vector3(-1, -1, 0), new Vector3(1, 1, 0)];
  const snapshot = JSON.stringify({ frame, screen, world });
  for (const mode of ['stroke', 'fill']) {
    const data = buildProjectedMaskData(frame, 0.1, screen, world, 3, mode);
    assert.equal(data.meshIndex, 3);
    assert.deepEqual(data.orientation, frame.orientation);
    assert.equal(data.mode, mode);
    assert.equal(data.size.x, mode === 'fill' ? 2.16 : 2.6);
    assert.equal(data.brushWidth, mode === 'stroke' ? 0.055 : undefined);
    assert.equal(data.maskPoints[0].x, mode === 'fill' ? 0.04 : 0.12);
  }
  assert.equal(JSON.stringify({ frame, screen, world }), snapshot);
});

function projectionRecord(id, cached = false) {
  const mask = structuredClone(projectedMask);
  if (!cached) delete mask.cachedGeometry;
  return { id, ...toAnnotationPayload({ kind: 'projectedRegion', label: `Region ${id}`, description: '', position, projectedMask: mask }) };
}

test('annotation loading preserves order and only persists newly generated caches', async () => {
  const events = [];
  const records = [projectionRecord(1, true), projectionRecord(2)];
  await loadViewerAnnotations(4, {
    getAnnotations: async () => records,
    updateAnnotation: async (id, payload) => {
      events.push(`save ${id}`);
      assert.deepEqual(payload.annotation_data.projectedMask.cachedGeometry, projectedMask.cachedGeometry);
      return { id, ...payload };
    },
  }, {
    isActive: () => true,
    replace: (annotations) => { assert.equal(annotations.length, 2); events.push('replace'); },
    render: (annotation, number) => {
      events.push(`render ${number}`);
      annotation.projectedMask.cachedGeometry = projectedMask.cachedGeometry;
    },
    onError: assert.fail,
  });
  assert.deepEqual(events, ['replace', 'render 1', 'render 2', 'save 2']);
});

test('a late annotation response after navigation never changes the view', async () => {
  let resolve;
  let active = true;
  const result = loadViewerAnnotations(1, {
    getAnnotations: () => new Promise((done) => { resolve = done; }),
    updateAnnotation: assert.fail,
  }, { isActive: () => active, replace: assert.fail, render: assert.fail, onError: assert.fail });
  active = false;
  resolve([projectionRecord(1)]);
  await result;
});

test('navigation during cache persistence prevents subsequent rendering', async () => {
  let active = true;
  const rendered = [];
  await loadViewerAnnotations(1, {
    getAnnotations: async () => [projectionRecord(1), projectionRecord(2)],
    updateAnnotation: async (id, payload) => { active = false; return { id, ...payload }; },
  }, {
    isActive: () => active,
    replace: () => {},
    render: (annotation) => {
      rendered.push(annotation.id);
      annotation.projectedMask.cachedGeometry = projectedMask.cachedGeometry;
    },
    onError: assert.fail,
  });
  assert.deepEqual(rendered, [1]);
});

test('one cache persistence failure does not prevent later annotations loading', async () => {
  const rendered = [];
  const errors = [];
  await loadViewerAnnotations(1, {
    getAnnotations: async () => [projectionRecord(1), projectionRecord(2)],
    updateAnnotation: async (id, payload) => {
      if (id === 1) throw new Error('Simulated save failure');
      return { id, ...payload };
    },
  }, {
    isActive: () => true,
    replace: () => {},
    render: (annotation) => {
      rendered.push(annotation.id);
      annotation.projectedMask.cachedGeometry = projectedMask.cachedGeometry;
    },
    onError: (message) => errors.push(message),
  });
  assert.deepEqual(rendered, [1, 2]);
  assert.equal(errors.length, 1);
});

test('annotation request failures report an error without touching the view', async () => {
  const errors = [];
  await loadViewerAnnotations(1, {
    getAnnotations: async () => { throw new Error('Simulated load failure'); },
    updateAnnotation: assert.fail,
  }, {
    isActive: () => true, replace: assert.fail, render: assert.fail,
    onError: (message) => errors.push(message),
  });
  assert.deepEqual(errors, ['Failed to load annotations:']);
});

test('selection and hover consistently activate only the matching annotation', () => {
  const a = { id: 1 };
  const b = { id: 2 };
  assert.equal(isAnnotationActive(a, a, null), true);
  assert.equal(isAnnotationActive(a, null, a), true);
  assert.equal(isAnnotationActive(a, b, b), false);
  assert.equal(isAnnotationActive(a, null, null), false);
  assert.equal(isAnnotationActive(undefined, a, b), false);
});

test('drawing coordinates account for canvas offset and reject zero-sized surfaces', () => {
  const pointer = { clientX: 150, clientY: 100 };
  assert.deepEqual(normalizeDrawingPoint(pointer, { left: 100, top: 50, width: 200, height: 100 }), { x: 0.25, y: 0.5 });
  assert.equal(normalizeDrawingPoint(pointer, { left: 0, top: 0, width: 0, height: 100 }), null);
  assert.equal(normalizeDrawingPoint(pointer, { left: 0, top: 0, width: 100, height: 0 }), null);
});

test('drawing samples filter jitter and keep screen/world/mesh samples aligned', () => {
  const samples = createDrawingSamples();
  const world = { x: 1, y: 2, z: 3 };
  assert.equal(samples.append({ x: 0, y: 0 }, world, 4), true);
  assert.equal(samples.accepts({ x: 0.001, y: 0.001 }), false);
  assert.equal(samples.append({ x: 0.001, y: 0.001 }, world, 5), false);
  assert.equal(samples.append({ x: 0.01, y: 0.01 }, world, 6), true);
  const snapshot = samples.snapshot();
  assert.equal(snapshot.screenPoints.length, 2);
  assert.equal(snapshot.worldPoints.length, 2);
  assert.deepEqual(snapshot.meshIndices, [4, 6]);
  world.x = 99;
  snapshot.worldPoints[0].x = 100;
  assert.equal(samples.snapshot().worldPoints[0].x, 1);
});

test('starting another drawing clears the previous stroke', () => {
  const samples = createDrawingSamples();
  samples.append({ x: 0.5, y: 0.5 }, position, 1);
  samples.reset();
  assert.deepEqual(samples.snapshot(), { screenPoints: [], worldPoints: [], meshIndices: [] });
  assert.equal(samples.accepts({ x: 0.5, y: 0.5 }), true);
});

test('Viewer DOM subscriptions handle input and detach every listener on cleanup', () => {
  const canvas = new EventTarget();
  const resizeTarget = new EventTarget();
  const events = [];
  const dispose = bindViewerEvents(canvas, {
    click: () => events.push('click'), pointerDown: () => events.push('down'),
    pointerMove: () => events.push('move'), pointerUp: () => events.push('up'), pointerCancel: () => events.push('cancel'),
    hover: () => events.push('hover'), resize: () => events.push('resize'),
  }, resizeTarget);
  for (const type of ['click', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) canvas.dispatchEvent(new Event(type));
  resizeTarget.dispatchEvent(new Event('resize'));
  resizeTarget.dispatchEvent(new Event('blur'));
  assert.deepEqual(events, ['click', 'down', 'move', 'hover', 'up', 'cancel', 'cancel', 'resize', 'cancel']);
  dispose();
  dispose();
  for (const type of ['click', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) canvas.dispatchEvent(new Event(type));
  resizeTarget.dispatchEvent(new Event('resize'));
  resizeTarget.dispatchEvent(new Event('blur'));
  assert.equal(events.length, 9);
});

test('projected annotation drafts keep existing fill/stroke defaults and camera metadata', () => {
  for (const mode of ['fill', 'stroke']) {
    const mask = { ...projectedMask, mode };
    const draft = createProjectedAnnotation(mask, view);
    assert.equal(draft.kind, mode === 'fill' ? 'projectedRegion' : 'projectedDraw');
    assert.equal(draft.opacity, mode === 'fill' ? 0.24 : 0.32);
    assert.equal(draft.color, mode === 'fill' ? '#22d3ee' : '#facc15');
    assert.deepEqual(draft.position, mask.position);
    assert.deepEqual(draft.view, view);
  }
});

test('basic rendering preserves legacy coordinates, appearance and missing-data behavior', () => {
  const base = { label: 'Legacy', description: '', position };
  const point = getBasicAnnotationVisuals({ ...base, kind: 'point' }, 2)[0];
  assert.equal(point.radius, 2);
  assert.equal(point.material.color, 0xff1a00);
  assert.deepEqual(point.position, position);
  const draw = getBasicAnnotationVisuals({ ...base, kind: 'draw', drawPoints: [position, { x: 4, y: 5, z: 6 }] }, 2);
  assert.equal(draw.length, 2);
  assert.equal(draw[0].radius, 0.44);
  assert.deepEqual(draw[0].material, { transparent: true, opacity: 0.3, depthWrite: false, color: 0xffcc00 });
  const region = getBasicAnnotationVisuals({ ...base, kind: 'region', regionTriangles: [position, { x: 4, y: 5, z: 6 }] }, 2)[0];
  assert.deepEqual(region.vertices, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(region.position, { x: 0, y: 0, z: 0 });
  assert.equal(region.material.color, 0x38bdf8);
  for (const kind of ['draw', 'region', 'projectedDraw', 'projectedRegion']) {
    assert.deepEqual(getBasicAnnotationVisuals({ ...base, kind }, 2), []);
  }
});


test('portrait framing contains the complete bounding sphere and scales clipping to the model', () => {
  for (const radius of [0.001, 1, 10000]) for (const aspect of [0.01, 0.25, 0.75, 1, 2]) {
    const frame = getModelFraming(radius, aspect, 75);
    const angularRadius = Math.asin(radius / frame.distance);
    const halfVertical = 75 * Math.PI / 360;
    assert.ok(angularRadius < Math.min(halfVertical, Math.atan(Math.tan(halfVertical) * aspect)));
    assert.ok(frame.near > 0 && frame.near < radius);
    assert.ok(frame.far > frame.distance + radius);
  }
  assert.ok(getModelFraming(1, 0.5, 75).distance > getModelFraming(1, 2, 75).distance);
});

test('moving annotations preserves identity and view data while invalidating projected geometry on the new mesh', () => {
  for (const kind of ['point', 'draw', 'region', 'projectedDraw', 'projectedRegion']) {
    const original = { id: 8, label: 'Linked part', description: 'Preserve', kind, position, view,
      drawPoints: [position], regionTriangles: [position], projectedMask };
    const before = JSON.stringify(original);
    const target = { x: 10, y: 20, z: 30 };
    const moved = repositionAnnotation(original, target, 9, view);
    assert.equal(moved.id, original.id);
    assert.equal(moved.label, original.label);
    assert.deepEqual(moved.drawPoints[0], target);
    assert.deepEqual(moved.regionTriangles[0], target);
    assert.deepEqual(moved.projectedMask.position, target);
    assert.equal(moved.projectedMask.meshIndex, 9);
    assert.equal(moved.projectedMask.cachedGeometry, undefined);
    assert.deepEqual(fromDbAnnotation({id: 8, ...toAnnotationPayload(moved)}).position, target);
    assert.equal(JSON.stringify(original), before);
  }
});


test('region gestures reject clicks and collinear strokes instead of saving invisible fills', () => {
  assert.equal(hasRegionArea([]), false);
  assert.equal(hasRegionArea([{x:0,y:0},{x:0.5,y:0.5},{x:1,y:1},{x:0,y:0}]), false);
  assert.equal(hasRegionArea([{x:0,y:0},{x:0.5,y:0.501},{x:1,y:1},{x:0,y:0}]), false);
  const polygon = [{x:0.1,y:0.1},{x:0.8,y:0.1},{x:0.8,y:0.8},{x:0.1,y:0.8}];
  assert.equal(hasRegionArea(polygon), true);
  assert.equal(hasRegionArea(polygon.toReversed()), true);
});


test('orbit/pan drag gestures do not select annotations and the next intentional click still works', () => {
  const canvas = new EventTarget(), target = new EventTarget();
  let clicks = 0, hovers = 0;
  const noop = () => {};
  const unbind = bindViewerEvents(canvas, { click: () => clicks++, pointerDown: noop, pointerMove: noop, pointerUp: noop, pointerCancel: noop, hover: () => hovers++, resize: noop }, target);
  const pointer = (type,x,y) => canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:1,clientX:x,clientY:y}));
  pointer('pointerdown',10,10); pointer('pointermove',80,80); pointer('pointerup',80,80);
  canvas.dispatchEvent(new Event('click'));
  assert.equal(clicks,0);
  pointer('pointermove',90,90);
  assert.equal(hovers,1);
  pointer('pointerdown',20,20); pointer('pointerup',20,20);
  canvas.dispatchEvent(new Event('lostpointercapture'));
  canvas.dispatchEvent(new Event('click'));
  assert.equal(clicks,1);
  unbind();
});
