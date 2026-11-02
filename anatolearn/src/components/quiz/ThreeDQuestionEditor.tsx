import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import type { ModelRecord, AnnotationRecord } from '../../types/anatomy';
import type { ThreeDFormat } from './ThreeDQuestion';

export type Teacher3DConfig = { model_id:number; reference_annotation_id?:number; annotation_ids?:number[] };
type Props = { format:ThreeDFormat; config:Teacher3DConfig|null; onChange:(next:Teacher3DConfig)=>void };

export default function ThreeDQuestionEditor({format,config,onChange}:Props){
  const [models,setModels]=useState<ModelRecord[]>([]);
  const [annotations,setAnnotations]=useState<AnnotationRecord[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    api.getModels().then((data:ModelRecord[])=>{if(!cancelled)setModels(data);}).catch((e:Error)=>!cancelled&&setError(e.message));
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    if(!config?.model_id){setAnnotations([]);return;}
    api.getAnnotations(config.model_id).then((data:AnnotationRecord[])=>{if(!cancelled){setAnnotations(data);setError('');}}).catch((e:Error)=>!cancelled&&setError(e.message));
    return()=>{cancelled=true;};
  },[config?.model_id]);
  const projected=annotations.filter(a=>a.annotation_data?.projectedMask?.maskPoints?.length);
  const filled=projected.filter(a=>a.annotation_type==='region_fill' && a.annotation_data?.projectedMask?.mode==='fill');
  return <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">3D question setup</h3>
    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Anatomy model
      <select value={config?.model_id||''} onChange={e=>onChange({model_id:Number(e.target.value)})}
        className="mt-1 w-full rounded-md p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm">
        <option value="">Select 3D model…</option>
        {models.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </label>
    {config?.model_id ? format==='region_identification' ?
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Teacher reference filled region
        <select value={config.reference_annotation_id||''} onChange={e=>onChange({...config,reference_annotation_id:Number(e.target.value)})}
          className="mt-1 w-full rounded-md p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm">
          <option value="">Select saved region…</option>
          {filled.map(a=><option value={a.id} key={a.id}>{a.label}</option>)}
        </select>
        <span className="block normal-case font-normal mt-1">Students will not see this reference while answering. The existing projected fill is the grading target.</span>
      </label>
    :<div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Select 2–6 numbered annotations ({config.annotation_ids?.length||0} selected)</p>
      {projected.length===0 && <p className="text-xs text-amber-700">No projected annotations on this model yet.</p>}
      <div className="max-h-44 overflow-y-auto space-y-1">
        {projected.map(a=>{
          const checked=(config.annotation_ids||[]).includes(a.id);
          return <label key={a.id} className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200">
            <input type="checkbox" checked={checked} disabled={!checked&&(config.annotation_ids||[]).length>=6} onChange={e=>{
              const ids=config.annotation_ids||[];
              onChange({...config,annotation_ids:e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id)});
            }}/>{a.label}
          </label>;
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">Students will see numbered regions and a shuffled name list; the matching key is checked on the server.</p>
    </div>:null}
    {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
