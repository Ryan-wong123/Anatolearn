import RequestState from './RequestState';
import { useResource } from '../hooks/useResource';
import { useState } from 'react';
import { api } from '../api/api';
interface BankQuestion {
  id:number; question:string; format:'mcq'|'open_ended'; category:string|null;
  option_a:string|null; option_b:string|null; option_c:string|null; option_d:string|null;
  correct_option:string|null; model_answer:string|null;
}
export default function QuestionBank({quizId,onImported}:{quizId:number;onImported:()=>void}) {
  const {data:questions,loading,error:loadError,reload:refresh}=useResource<BankQuestion[]>(api.getQuestionBank,[]);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<BankQuestion|null>(null);
  const [error,setError]=useState('');
  async function act(operation:()=>Promise<unknown>){
    try{setBusy(true);setError('');await operation();await refresh();onImported();setEditing(null);}
    catch(e){setError(e instanceof Error?e.message:'Question bank update failed');}
    finally{setBusy(false);}
  }
  const filtered=questions.filter((q)=>(q.question+' '+(q.category||'')).toLowerCase().includes(search.toLowerCase()));
  const input='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm';
  return <details className="my-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-slate-900 dark:text-slate-100">
    <summary onClick={()=>void refresh()} className="cursor-pointer">Question bank — browse, edit and import</summary>
    <RequestState loading={loading} error={loadError} onRetry={refresh} label="question bank" />
    <input aria-label="Search question bank by question or body system" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search question or body system" className={input+' my-2'} />
    <div className="max-h-60 overflow-y-auto space-y-2">{filtered.map((q)=><div key={q.id} className="rounded border p-2 text-sm">
      <p>{q.question} <span className="text-xs text-slate-500">{q.category || 'Uncategorised'}</span></p>
      <div className="flex flex-wrap gap-3 mt-2">
        <button disabled={busy} onClick={()=>void act(()=>api.importQuestion(quizId,q.id))} className="text-blue-600 hover:underline">Add to quiz</button>
        <button disabled={busy} onClick={()=>setEditing({...q})} className="text-blue-600 hover:underline">Edit bank copy</button>
        <button disabled={busy} onClick={()=>void act(()=>api.deleteBankQuestion(q.id))} className="text-red-600 hover:underline">Remove from bank</button>
      </div>
    </div>)}</div>
    {editing && <div className="space-y-2 mt-3">
      <label className="block text-sm">Question<input className={input} value={editing.question} onChange={(e)=>setEditing({...editing,question:e.target.value})}/></label>
      <label className="block text-sm">Body system<input className={input} value={editing.category||''} onChange={(e)=>setEditing({...editing,category:e.target.value})}/></label>
      {editing.format==='mcq' ? <>{(['option_a','option_b','option_c','option_d'] as const).map((key)=><label key={key} className="block text-sm">{key.replace('_',' ')}<input className={input} value={editing[key]||''} onChange={(e)=>setEditing({...editing,[key]:e.target.value})}/></label>)}
        <label className="block text-sm">Correct option<select className={input} value={editing.correct_option||'A'} onChange={(e)=>setEditing({...editing,correct_option:e.target.value})}>{['A','B','C','D'].map((letter)=><option key={letter}>{letter}</option>)}</select></label>
      </> : <label className="block text-sm">Model answer<textarea className={input} value={editing.model_answer||''} onChange={(e)=>setEditing({...editing,model_answer:e.target.value})}/></label>}
      <button disabled={busy} onClick={()=>void act(()=>api.updateBankQuestion(editing.id,editing))} className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">Save bank copy</button>
      <button disabled={busy} onClick={()=>setEditing(null)} className="ml-3 hover:underline">Cancel</button>
    </div>}
    {!loading&&!loadError&&filtered.length===0&&<p className="text-sm text-slate-500">{search ? 'No bank questions match your search.' : 'Save a quiz question to the bank to reuse it in other assessments.'}</p>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
  </details>;
}
