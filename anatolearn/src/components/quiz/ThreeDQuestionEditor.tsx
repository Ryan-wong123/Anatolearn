import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import type { ModelRecord, AnnotationRecord } from '../../types/anatomy';
import ThreeDQuestion, { type QuizCustomMarker, type QuizCustomRegion, type ThreeDFormat } from './ThreeDQuestion';

export type Teacher3DConfig = {
  model_id: number;
  source?: 'existing' | 'custom';
  reference_annotation_id?: number;
  annotation_ids?: number[];
  custom_region?: QuizCustomRegion;
  custom_markers?: QuizCustomMarker[];
  target_count?: number;
};
type Props = { format: ThreeDFormat; config: Teacher3DConfig | null; onChange: (next: Teacher3DConfig) => void };
const MARKER_COLORS = ['#38bdf8','#a78bfa','#fbbf24','#34d399','#f472b6','#fb923c'] as const;
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100';

export default function ThreeDQuestionEditor({ format, config, onChange }: Props) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [error, setError] = useState('');
  const source = config?.source === 'custom' ? 'custom' : 'existing';
  const markers = config?.custom_markers || [];

  useEffect(() => {
    let cancelled = false;
    api.getModels().then((data: ModelRecord[]) => { if (!cancelled) setModels(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!config?.model_id) { setAnnotations([]); return; }
    api.getAnnotations(config.model_id).then((data: AnnotationRecord[]) => {
      if (!cancelled) { setAnnotations(data); setError(''); }
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [config?.model_id]);

  const projected = annotations.filter(a => a.annotation_data?.projectedMask?.maskPoints?.length);
  const filled = projected.filter(a => a.annotation_type === 'region_fill' && a.annotation_data?.projectedMask?.mode === 'fill');

  const changeSource = (nextSource: 'existing' | 'custom') => {
    if (!config) return;
    onChange({ ...config, source: nextSource });
  };
  const targetCount = config?.target_count ?? Math.max(2, markers.length);
  const addMarker = (marker: Omit<QuizCustomMarker, 'id' | 'label'>) => {
    if (!config || markers.length >= targetCount || markers.length >= 12 || !marker.region?.projectedMask) return;
    const nextId = Math.max(0, ...markers.map(m => m.id)) + 1;
    onChange({ ...config, source: 'custom', target_count: targetCount,
      custom_markers: [...markers, { ...marker, id: nextId, label: '' }] });
  };

  return <section className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4 sm:p-5 space-y-4">
    <div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">3D question setup</h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Choose a model, then either reuse existing annotations or create private grading references for this question.</p>
    </div>
    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Anatomy model
      <select value={config?.model_id || ''} onChange={e => onChange({ model_id: Number(e.target.value), source })} className={inputClass}>
        <option value="">Select 3D model…</option>
        {models.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </label>
    {!!config?.model_id && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="3D annotation source">
        <button type="button" onClick={() => changeSource('existing')} aria-pressed={source === 'existing'}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${source === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700'}`}>
          Use existing annotations
        </button>
        <button type="button" onClick={() => changeSource('custom')} aria-pressed={source === 'custom'}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${source === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700'}`}>
          Create new annotations
        </button>
      </div>
      {source === 'existing' ? (
        format === 'region_identification' ?
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Teacher reference filled region
            <select value={config.reference_annotation_id || ''} onChange={e => onChange({ ...config, reference_annotation_id: Number(e.target.value) })} className={inputClass}>
              <option value="">Select saved region…</option>
              {filled.map(a => <option value={a.id} key={a.id}>{a.label}</option>)}
            </select>
            <span className="block normal-case font-normal mt-2">Students will not see this reference while answering. It is used for grading.</span>
          </label>
        : <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Select 2–6 annotations ({config.annotation_ids?.length || 0} selected)</p>
          {projected.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-400">No projected annotations on this model yet.</p>}
          <div className="max-h-52 overflow-y-auto space-y-1">
            {projected.map(a => {
              const checked = (config.annotation_ids || []).includes(a.id);
              return <label key={a.id} className="flex items-center gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200">
                <input type="checkbox" checked={checked} disabled={!checked && (config.annotation_ids || []).length >= 6}
                  onChange={e => {
                    const ids = config.annotation_ids || [];
                    onChange({ ...config, annotation_ids: e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id) });
                  }}/>{a.label}
              </label>;
            })}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">Students see numbered markers and a shuffled name list.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 p-3 text-sm text-slate-700 dark:text-slate-300">
            {format === 'region_identification'
              ? 'Draw a closed outline on the model to define the correct region. The reference is private to this quiz question and is not added to the main viewer.'
              : 'Choose the number of structures (2–12). Draw a filled region for each; each region gets its own numbered marker. Then give every structure a distinct name. These annotations remain private to this quiz.'}
          </div>
          {format === 'region_identification' ? <>
            <ThreeDQuestion key={`${config.model_id}-region`} format="region_identification" authoring="region"
              config={{ model_id: config.model_id }} value={JSON.stringify({ points: config.custom_region?.points || [] })}
              viewerClassName="h-[min(62vh,590px)] min-h-[370px] w-full"
              onChange={value => {
                try {
                  const data = JSON.parse(value) as QuizCustomRegion;
                  if (data?.projectedMask && Array.isArray(data.points)) onChange({ ...config, source: 'custom', custom_region: data });
                  else onChange({ ...config, source: 'custom', custom_region: undefined });
                } catch { onChange({ ...config, source: 'custom', custom_region: undefined }); }
              }}/>
            <p aria-live="polite" className="text-sm text-slate-700 dark:text-slate-300">
              {config.custom_region?.points.length ? `Reference drawn (${config.custom_region.points.length} surface points).` : 'No reference drawn yet.'}
            </p>
          </> : <>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Number of structures to identify
              <input type="number" min={Math.max(2,markers.length)} max={12} step={1} value={targetCount}
                onChange={e => {
                  const count=Number(e.target.value);
                  if(Number.isSafeInteger(count) && count>=Math.max(2,markers.length) && count<=12)
                    onChange({ ...config, source:'custom', target_count:count });
                }} className={inputClass + ' max-w-32'} />
              <span className="block mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">Choose 2–12. Remove a drawn structure before reducing this number.</span>
            </label>
            <ThreeDQuestion key={`${config.model_id}-matching`} format="annotation_matching" authoring="matching"
              config={{ model_id: config.model_id, marker_ids: markers.map(m => m.id), custom_markers: markers }}
              value="" onChange={() => {}} onPlaceMarker={addMarker}
              disabled={markers.length>=targetCount}
              viewerClassName="h-[min(62vh,590px)] min-h-[370px] w-full"/>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Question structures ({markers.length}/{targetCount})</p>
              {markers.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Select Draw structure above, then drag an outline around the anatomical structure on the model.</p>}
              {markers.map((marker, i) => <div key={marker.id} className="flex items-center gap-2">
                <span style={{backgroundColor:MARKER_COLORS[i%MARKER_COLORS.length]}} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-950 font-semibold text-sm">{i+1}</span>
                <input type="text" aria-label={`Anatomical name for marker ${i+1}`} value={marker.label || ''} maxLength={120}
                  onChange={e => onChange({ ...config, source: 'custom', custom_markers: markers.map(m => m.id === marker.id ? { ...m, label: e.target.value } : m) })}
                  placeholder="Anatomical structure name" className={inputClass + ' !mt-0 flex-1 min-w-0'} />
                <button type="button" onClick={() => onChange({ ...config, source: 'custom', custom_markers: markers.filter(m => m.id !== marker.id) })}
                  className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400" aria-label={`Remove marker ${i+1}`}>Remove</button>
              </div>)}
              <p className="text-xs text-slate-600 dark:text-slate-400">Each numbered marker must have a drawn region and a different anatomical name. The quiz is ready when all {targetCount} structures are defined.</p>
              {markers.some(m=>!m.region?.projectedMask) && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">This question contains older point-only markers. Remove and redraw them as highlighted structures to use the new matching format.</p>}
            </div>
          </>}
        </div>
      )}
    </>}
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
  </section>;
}
