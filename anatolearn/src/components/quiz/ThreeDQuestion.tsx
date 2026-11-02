import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { api } from '../../api/api';
import { fromDbAnnotation } from '../viewer/annotationMapping';
import { createProjectedMaskMesh } from '../viewer/projectedMask';
import { getModelFraming } from '../viewer/modelFraming';
import { createRegionFeedbackMesh, type RegionReview } from './regionFeedback';
import type { AnnotationRecord, ModelRecord, DrawPoint } from '../../types/anatomy';

export type ThreeDFormat = 'region_identification' | 'annotation_matching';
export type Student3DConfig = { model_id:number; marker_ids?:number[]; options?:string[] };
type Answer = { points?:DrawPoint[]; matches?:Record<string,string> };
type Props = { format:ThreeDFormat; config:Student3DConfig; value:string; onChange:(answer:string)=>void; disabled?:boolean; review?:RegionReview };
const parse = (text:string):Answer => { try { return JSON.parse(text) as Answer; } catch { return {}; } };

type MarkerSample = { point:THREE.Vector3; normal:THREE.Vector3 };
type QuizMarker = { sprite:THREE.Sprite; samples:MarkerSample[]; surfaceVisible:boolean };

/**
 * Select surface points that genuinely belong to the painted decal. The
 * annotation's saved position is the projector centre, which can be INSIDE
 * the model and must not be used as a depth-tested badge location.
 */
function markerSurfaceSamples(visual:THREE.Mesh, anchor:THREE.Vector3):MarkerSample[] {
  const position=visual.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const normal=visual.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv=visual.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if(!position || position.count<3)return [];
  const mask=visual.userData.maskCanvas as HTMLCanvasElement | undefined;
  const context=mask?.getContext('2d',{willReadFrequently:true});
  const alpha=context && mask ? context.getImageData(0,0,mask.width,mask.height).data : null;
  const triangles=Math.floor(position.count/3);
  const stride=Math.max(1,Math.ceil(triangles/480));
  const candidates:MarkerSample[]=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const norm=new THREE.Vector3();
  for(let t=0;t<triangles;t+=stride){
    const k=t*3;
    if(alpha && uv && mask){
      const u=(uv.getX(k)+uv.getX(k+1)+uv.getX(k+2))/3;
      const v=(uv.getY(k)+uv.getY(k+1)+uv.getY(k+2))/3;
      const x=Math.max(0,Math.min(mask.width-1,Math.floor(u*mask.width)));
      const y=Math.max(0,Math.min(mask.height-1,Math.floor((1-v)*mask.height)));
      if(alpha[(y*mask.width+x)*4+3]<=20)continue;
    }
    a.fromBufferAttribute(position,k);
    b.fromBufferAttribute(position,k+1);
    c.fromBufferAttribute(position,k+2);
    const point=a.clone().add(b).add(c).multiplyScalar(1/3);
    if(normal){
      norm.fromBufferAttribute(normal,k)
        .add(new THREE.Vector3().fromBufferAttribute(normal,k+1))
        .add(new THREE.Vector3().fromBufferAttribute(normal,k+2));
    }else{
      norm.crossVectors(b.clone().sub(a),c.clone().sub(a));
    }
    if(norm.lengthSq()<1e-12)continue;
    candidates.push({point,normal:norm.clone().normalize()});
  }
  if(!candidates.length)return [];
  // Prefer the original anchor, but retain spread-out candidates so a large
  // region can still have a visible marker when partially hidden.
  const nearest=[...candidates].sort((x,y)=>x.point.distanceToSquared(anchor)-y.point.distanceToSquared(anchor));
  const samples=nearest.slice(0,5);
  const strideOut=Math.max(1,Math.ceil(candidates.length/20));
  for(let i=0;i<candidates.length && samples.length<25;i+=strideOut){
    if(!samples.includes(candidates[i]))samples.push(candidates[i]);
  }
  return samples;
}

function updateMarkerVisibility(markers:QuizMarker[],camera:THREE.Camera,meshes:THREE.Mesh[],radius:number){
  const eye=camera.position;
  const raycaster=new THREE.Raycaster();
  const direction=new THREE.Vector3();
  const tolerance=Math.max(radius*0.012,0.0001);
  for(const marker of markers){
    marker.surfaceVisible=false;
    marker.sprite.visible=false;
    // Raycast only against the original model, never the decal or badge.
    // Try several painted surface points to handle partially hidden regions.
    const facing=marker.samples.filter(s=>s.normal.dot(direction.subVectors(eye,s.point))>radius*0.004);
    for(const sample of facing.slice(0,5)){
      direction.subVectors(sample.point,eye);
      const distance=direction.length();
      if(distance<1e-8)continue;
      raycaster.set(eye,direction.multiplyScalar(1/distance));
      raycaster.near=0;
      raycaster.far=distance+tolerance;
      const hit=raycaster.intersectObjects(meshes,false)[0];
      if(hit && hit.distance<distance-tolerance)continue;
      marker.sprite.position.copy(sample.point);
      marker.surfaceVisible=true;
      marker.sprite.visible=true;
      break;
    }
  }
}

export default function ThreeDQuestion({format,config,value,onChange,disabled=false,review}:Props){
  const area=useRef<HTMLDivElement>(null);
  const [model,setModel]=useState<ModelRecord|null>(null);
  const [records,setRecords]=useState<AnnotationRecord[]>([]);
  const [error,setError]=useState('');
  const [mode,setMode]=useState<'orbit'|'draw'>('orbit');
  const [loaded,setLoaded]=useState(false);
  const answer=parse(value);
  const selected=answer.matches||{};
  const points=answer.points||[];
  const write=useRef(onChange);
  const current=useRef(value);
  const drawingEnabled=useRef(false);
  useEffect(()=>{ write.current=onChange; current.current=value; },[onChange,value]);
  useEffect(()=>{drawingEnabled.current = !disabled && format==='region_identification' && mode==='draw';},[format,mode,disabled]);

  useEffect(()=>{
    let cancelled=false;
    setModel(null);setRecords([]);setLoaded(false);setError('');
    Promise.all([api.getModel(config.model_id),api.getAnnotations(config.model_id)]).then(([m,a]:[ModelRecord,AnnotationRecord[]])=>{
      if(cancelled)return;
      setModel(m);setRecords(a);
    }).catch((e:unknown)=>!cancelled&&setError(e instanceof Error?e.message:'Could not load model'));
    return()=>{cancelled=true;};
  },[config.model_id]);

  useEffect(()=>{
    if(!area.current||!model)return;
    const container=area.current;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#0f172a');
    const camera=new THREE.PerspectiveCamera(46,1,0.01,10000);
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction='none';
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
    const hemi=new THREE.HemisphereLight(0xffffff,0x334155,2.3);scene.add(hemi);
    const light=new THREE.DirectionalLight(0xffffff,2.1);light.position.set(2,5,6);scene.add(light);
    const root=new THREE.Group();scene.add(root);
    let sourceMeshes:THREE.Mesh[]=[];
    const hits=new THREE.Raycaster();const mouse=new THREE.Vector2();
    const stroke=new THREE.Group();scene.add(stroke);
    const visuals=new THREE.Group();scene.add(visuals);
    let drawing=false;let pointer:number|null=null;let localPoints:DrawPoint[]=[];
    let disposed=false;let sizeRadius=1;
    const quizMarkers:QuizMarker[]=[];
    // Keep marker hiding independent of sprite.visible: otherwise the marker
    // would flicker back as soon as it disappears under the cursor.
    const pointerOnBadge=new THREE.Vector2();
    let pointerInsideViewer=false;
    const cameraRight=new THREE.Vector3();
    const badgeNdc=new THREE.Vector3();
    const edgeNdc=new THREE.Vector3();
    function refreshBadgeHover(){
      if(format!=='annotation_matching')return;
      const rect=renderer.domElement.getBoundingClientRect();
      if(rect.width<=0 || rect.height<=0)return;
      cameraRight.set(1,0,0).applyQuaternion(camera.quaternion);
      for(const marker of quizMarkers){
        if(!marker.surfaceVisible){marker.sprite.visible=false;continue;}
        if(!pointerInsideViewer){marker.sprite.visible=true;continue;}
        badgeNdc.copy(marker.sprite.position).project(camera);
        // No badge should be interactable when its location is off-screen.
        if(badgeNdc.z < -1 || badgeNdc.z > 1){marker.sprite.visible=false;continue;}
        edgeNdc.copy(marker.sprite.position).addScaledVector(cameraRight,marker.sprite.scale.x*0.5).project(camera);
        const centreX=(badgeNdc.x+1)*rect.width*0.5;
        const centreY=(1-badgeNdc.y)*rect.height*0.5;
        // The canvas badge's painted circle has radius 58/64 of its quad.
        // A small extra margin makes hovering predictable near its edge.
        const radius=Math.max(12,Math.abs(edgeNdc.x-badgeNdc.x)*rect.width*0.5*(58/64)+6);
        const dx=pointerOnBadge.x-centreX;
        const dy=pointerOnBadge.y-centreY;
        marker.sprite.visible=dx*dx+dy*dy>radius*radius;
      }
    }
    function markerPointerMove(e:PointerEvent){
      const rect=renderer.domElement.getBoundingClientRect();
      pointerOnBadge.set(e.clientX-rect.left,e.clientY-rect.top);
      pointerInsideViewer=pointerOnBadge.x>=0 && pointerOnBadge.x<=rect.width && pointerOnBadge.y>=0 && pointerOnBadge.y<=rect.height;
      refreshBadgeHover();
    }
    function markerPointerLeave(){pointerInsideViewer=false;refreshBadgeHover();}
    let markerRefreshNeeded=false;
    let markerRefreshAt=0;
    const previousCameraPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
    const previousCameraRotation=new THREE.Quaternion();
    function updateStroke(list:DrawPoint[]){
      stroke.clear();
      if(list.length<2)return;
      const geom=new THREE.BufferGeometry().setFromPoints(list.map(p=>new THREE.Vector3(p.x,p.y,p.z)));
      const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:'#fbbf24',depthTest:false,linewidth:2}));
      line.renderOrder=45;stroke.add(line);
    }
    function hitPoint(event:PointerEvent){
      const rect=renderer.domElement.getBoundingClientRect();
      mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      hits.setFromCamera(mouse,camera);
      const intersect=hits.intersectObjects(sourceMeshes,false)[0];
      if(!intersect)return null;
      const normal=intersect.face?.normal.clone().transformDirection(intersect.object.matrixWorld) || new THREE.Vector3();
      return intersect.point.clone().addScaledVector(normal,sizeRadius*0.001);
    }
    function down(e:PointerEvent){
      if(!drawingEnabled.current)return;
      if(e.button!==0)return;
      const p=hitPoint(e);if(!p)return;
      drawing=true;pointer=e.pointerId;renderer.domElement.setPointerCapture(pointer);
      localPoints=[{x:p.x,y:p.y,z:p.z}];updateStroke(localPoints);
    }
    function move(e:PointerEvent){
      if(!drawing||pointer!==e.pointerId)return;
      const p=hitPoint(e);if(!p)return;
      const prev=localPoints.at(-1)!;
      if(p.distanceTo(new THREE.Vector3(prev.x,prev.y,prev.z))<sizeRadius*0.006)return;
      if(localPoints.length<256)localPoints.push({x:p.x,y:p.y,z:p.z});
      updateStroke(localPoints);
    }
    function up(e:PointerEvent){
      if(!drawing||pointer!==e.pointerId)return;
      drawing=false;pointer=null;
      if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
      if(localPoints.length>=3)write.current(JSON.stringify({points:localPoints}));
    }
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('pointermove',markerPointerMove);
    canvas.addEventListener('pointerleave',markerPointerLeave);
    function resize(){const w=container.clientWidth,h=container.clientHeight||400;if(!w||!h)return;
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
    const ro=new ResizeObserver(resize);ro.observe(container);resize();
    let frame=0;
    function tick(){
      frame=requestAnimationFrame(tick);
      controls.enabled=!drawingEnabled.current;
      controls.update();
      if(quizMarkers.length){
        const moved=camera.position.distanceToSquared(previousCameraPosition)>sizeRadius*sizeRadius*0.000001 ||
          camera.quaternion.angleTo(previousCameraRotation)>0.003;
        if(moved)markerRefreshNeeded=true;
        if(markerRefreshNeeded && performance.now()-markerRefreshAt>300){
          updateMarkerVisibility(quizMarkers,camera,sourceMeshes,sizeRadius);
          refreshBadgeHover();
          previousCameraPosition.copy(camera.position);
          previousCameraRotation.copy(camera.quaternion);
          markerRefreshAt=performance.now();
          markerRefreshNeeded=false;
        }
      }
      renderer.render(scene,camera);
    }
    tick();
    const path=model.file_path.toLowerCase();
    const onLoaded=(obj:THREE.Object3D)=>{
      if(disposed)return;
      root.add(obj);
      sourceMeshes=[];obj.traverse(child=>{if((child as THREE.Mesh).isMesh)sourceMeshes.push(child as THREE.Mesh);});
      const sphere=new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      sizeRadius=Math.max(sphere.radius,0.001);
      const frame=getModelFraming(sizeRadius,camera.aspect,camera.fov);
      camera.near=frame.near;camera.far=frame.far;camera.updateProjectionMatrix();
      controls.minDistance=frame.minDistance;controls.maxDistance=frame.maxDistance;
      controls.target.copy(sphere.center);
      if(model.neutral_view){const n=model.neutral_view;camera.position.set(n.cameraPosition.x,n.cameraPosition.y,n.cameraPosition.z);controls.target.set(n.target.x,n.target.y,n.target.z);}
      else camera.position.copy(sphere.center.clone().add(new THREE.Vector3(0,0,frame.distance)));
      controls.update();
      if(format==='annotation_matching'){
        (config.marker_ids||[]).forEach((id,index)=>{
          const row=records.find(a=>a.id===id);if(!row)return;
          const a=fromDbAnnotation(row);
          const anchor=new THREE.Vector3(a.position.x,a.position.y,a.position.z);
          let samples:MarkerSample[]=[];
          if(a.projectedMask && sourceMeshes[a.projectedMask.meshIndex]){
            const visual=createProjectedMaskMesh(sourceMeshes[a.projectedMask.meshIndex],{...a,color:'#38bdf8',opacity:0.42});
            if(visual){
              visuals.add(visual);
              samples=markerSurfaceSamples(visual,anchor);
            }
          }
          // Older/point annotations may have no projected geometry. Their
          // anchor is normally on the surface; use it as a fallback only.
          if(!samples.length){
            const outward=anchor.clone().sub(sphere.center).normalize();
            if(outward.lengthSq()>0)samples=[{point:anchor,normal:outward}];
          }
          const badge=document.createElement('canvas');badge.width=128;badge.height=128;
          const ctx=badge.getContext('2d');
          if(ctx){ctx.fillStyle='#1d4ed8';ctx.beginPath();ctx.arc(64,64,58,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 76px Arial';ctx.fillText(String(index+1),64,68);}
          // The badge is either completely visible or hidden. Per-pixel depth
          // testing made numbers clip into this highly irregular scan.
          const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(badge),depthTest:false,depthWrite:false,transparent:true}));
          sprite.position.copy(anchor);
          sprite.scale.setScalar(sizeRadius*0.10);
          sprite.renderOrder=70;
          sprite.visible=false;
          visuals.add(sprite);
          quizMarkers.push({sprite,samples,surfaceVisible:false});
        });
      }
      if(quizMarkers.length)markerRefreshNeeded=true;
      if(format==='region_identification' && review){
        const mesh=createRegionFeedbackMesh(sourceMeshes,records,review,parse(current.current).points||[]);
        if(mesh)visuals.add(mesh);
        else setError('Could not render region feedback on this model. The score is still available.');
      } else if(format==='region_identification') {
        updateStroke(parse(current.current).points||[]);
      }
      setLoaded(true);
    };
    let loadError=(err:unknown)=>{if(!disposed)setError(err instanceof Error?err.message:'Model could not be loaded')};
    if(path.endsWith('.obj'))new OBJLoader().load(model.file_path,onLoaded,undefined,loadError);
    else if(path.endsWith('.usdz'))new USDLoader().load(model.file_path,onLoaded,undefined,loadError);
    else new GLTFLoader().load(model.file_path,gltf=>onLoaded(gltf.scene),undefined,loadError);
    return()=>{
      disposed=true;cancelAnimationFrame(frame);ro.disconnect();controls.dispose();
      canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);
      canvas.removeEventListener('pointermove',markerPointerMove);canvas.removeEventListener('pointerleave',markerPointerLeave);
      scene.traverse(obj=>{
        if((obj as THREE.Mesh).isMesh){const mesh=obj as THREE.Mesh;mesh.geometry.dispose();}
        const material=(obj as THREE.Mesh).material;if(material){(Array.isArray(material)?material:[material]).forEach(m=>{if(m instanceof THREE.MeshBasicMaterial){m.alphaMap?.dispose();m.map?.dispose();}m.dispose();});}
      });
      renderer.dispose();renderer.forceContextLoss();if(container.contains(canvas))container.removeChild(canvas);
    };
  // Recreate on question/model switch, not per answer update.
  },[model,records,format,config.marker_ids,review]);

  return <div className="space-y-3">
    <div className="rounded-xl overflow-hidden border border-slate-700 relative bg-slate-900">
      <div ref={area} className="h-[380px] w-full" aria-label="Interactive anatomical model"/>
      {!loaded && !error && <div className="absolute top-3 left-3 text-xs text-white bg-slate-900/80 px-3 py-2 rounded">Loading 3D model…</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center text-red-300 bg-slate-900/90 p-4 text-center">{error}</div>}
    </div>
    {format==='region_identification' && review ? <>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700 dark:text-slate-300" aria-label="Region grading colour key">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-green-500"/> Correctly shaded</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500"/> Missed reference area</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500"/> Extra shading</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Rotate and zoom the model to inspect your answer against the teacher's reference. Areas far outside the reference projector may not appear in this overlay.</p>
    </> : format==='region_identification' ? <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={()=>setMode('orbit')} className={`px-3 py-2 text-sm rounded-lg border ${mode==='orbit'?'bg-blue-600 text-white border-blue-600':'border-slate-400'}`}>Rotate / Zoom</button>
        <button type="button" onClick={()=>setMode('draw')} className={`px-3 py-2 text-sm rounded-lg border ${mode==='draw'?'bg-blue-600 text-white border-blue-600':'border-slate-400'}`} disabled={disabled}>Draw Region</button>
        <button type="button" onClick={()=>{onChange('');setMode('draw');setModel(m=>m?{...m}:m);}} className="px-3 py-2 text-sm rounded-lg border border-slate-400" disabled={disabled}>Clear selection</button>
        <span className="text-xs text-slate-500 dark:text-slate-400">{points.length>=3?`${points.length} surface points selected`:'Rotate to the target, then draw a closed outline on the model'}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">In Draw Region mode, drag over the model to outline the anatomical structure. The final point connects to the first.</p>
    </>:<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(config.marker_ids||[]).map((id,i)=><label key={id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm flex gap-3 items-center">
        <span className="flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-full bg-blue-600 text-white font-semibold">{i+1}</span>
        <select aria-label={`Structure ${i+1}`} disabled={disabled} value={selected[String(id)]||''}
          onChange={e=>onChange(JSON.stringify({matches:{...selected,[String(id)]:e.target.value}}))}
          className="bg-white dark:bg-slate-900 dark:text-slate-100 rounded-md border border-slate-300 dark:border-slate-600 p-2 flex-1 min-w-0">
          <option value="">Choose anatomical structure…</option>
          {(config.options||[]).map(name=><option value={name} key={name}>{name}</option>)}
        </select>
      </label>)}
    </div>}
  </div>;
}
