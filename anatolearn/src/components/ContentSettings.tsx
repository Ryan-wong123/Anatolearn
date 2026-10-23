import RequestState from './RequestState';
import { useResource } from '../hooks/useResource';
import { useState } from 'react';
import { api } from '../api/api';
import { useAppContext } from '../context/AppContextState';
interface ContentSettingsProps {
  kind: 'models' | 'videos' | 'quizzes' | 'resources';
  id: number;
  onSaved: () => void;
  programId?: number | null;
  timer?: number | null;
  downloadable?: boolean;
}
export default function ContentSettings({ kind, id, onSaved, programId, timer, downloadable }: ContentSettingsProps) {
  const { role } = useAppContext();
  const {data:programs,loading,error:programsError,reload} = useResource<{id:number;name:string}[]>(api.getPrograms,[]);
  const [value, setValue] = useState(programId ? String(programId) : '');
  const [seconds, setSeconds] = useState(timer ? String(timer) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(false); }
  }
  return role === 'teacher' && <details onClick={(e) => e.stopPropagation()} onKeyDown={(e)=>e.stopPropagation()} className="mt-3 w-full text-sm text-slate-700 dark:text-slate-300">
    <summary className="cursor-pointer rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500">Content permissions and settings</summary>
    <RequestState loading={loading} error={programsError} onRetry={reload} label="programme choices" />
    <div className="flex flex-wrap gap-2 py-2">
      <select disabled={loading || Boolean(programsError)} aria-label="Assign programme" value={value} onChange={(e)=>setValue(e.target.value)} className="rounded border p-2 bg-white dark:bg-slate-900">
        <option value="">All programmes</option>{programs.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={busy || loading || Boolean(programsError)} onClick={()=>void save(()=>api.setProgram(kind,id,value ? Number(value) : null))} className="rounded border px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-50">Assign programme</button>
      {kind === 'models' && <>
        <label className="flex items-center gap-2">
          <span>Downloads</span>
          <select disabled={busy} aria-label="Model downloads" value={downloadable ? 'enabled' : 'disabled'}
            onChange={(e)=>void save(()=>api.setDownloadPermission(id,e.target.value === 'enabled'))}
            className="rounded border p-2 bg-white dark:bg-slate-900 disabled:opacity-50">
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </>}
      {kind === 'quizzes' && <>
        <input aria-label="Quiz time limit in seconds" type="number" min="30" max="86400" placeholder="Seconds (blank = untimed)" value={seconds} onChange={(e)=>setSeconds(e.target.value)} className="rounded border p-2 bg-white dark:bg-slate-900" />
        <button disabled={busy} onClick={()=>void save(()=>api.setQuizTimer(id,seconds ? Number(seconds) : null))} className="rounded border px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800">Save timer</button>
      </>}
    </div>
    {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
  </details>;
}
