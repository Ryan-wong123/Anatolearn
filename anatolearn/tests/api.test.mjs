import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from '../src/api/api.ts';

test('API errors preserve validation, distinguish outages and expire protected JSON/download sessions', async () => {
  const original = { fetch:globalThis.fetch, storage:globalThis.sessionStorage, window:globalThis.window };
  const stored = new Map();
  const events = new EventTarget();
  let expired = 0;
  events.addEventListener('anatolearn-session-expired', () => expired++);
  globalThis.sessionStorage = { getItem:key=>stored.get(key)??null, setItem:(key,value)=>stored.set(key,value), removeItem:key=>stored.delete(key) };
  globalThis.window = events;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api.getModels(), error => error instanceof ApiError && error.status===0 && /connect to the server/.test(error.message));
    globalThis.fetch = async () => new Response('not JSON',{status:200});
    await assert.rejects(api.getModels(), /unreadable response/);
    globalThis.fetch = async () => new Response('Bad gateway',{status:502});
    await assert.rejects(api.getModels(), /server could not complete/);
    globalThis.fetch = async () => Response.json({message:'internal database diagnostics'},{status:500});
    await assert.rejects(api.getModels(), error => /server could not complete/.test(error.message) && !/database/.test(error.message));
    globalThis.fetch = async () => Response.json({message:'Upload self-contained glTF'},{status:400});
    await assert.rejects(api.getModels(), error => error.status===400 && error.message==='Upload self-contained glTF');
    globalThis.fetch = async () => Response.json({message:'Invalid email or password'},{status:401});
    stored.set('anatolearn_user','{"id":1}');
    await assert.rejects(api.login('test@example.test','invalid'), /Invalid email or password/);
    assert.equal(expired,0);
    assert.equal(stored.get('anatolearn_user'),'{"id":1}');
    await assert.rejects(api.getModels(), error => error.status===401);
    assert.equal(stored.has('anatolearn_user'),false);
    stored.set('anatolearn_user','{"id":1}');
    await assert.rejects(api.downloadModel(1), error => error.status===401);
    assert.equal(stored.has('anatolearn_user'),false);
    assert.equal(expired,2);
    globalThis.fetch = async () => Response.json({message:'Too many requests. Please try again later.'},{status:429});
    await assert.rejects(api.getModels(), error => error.status===429 && /Too many requests/.test(error.message));
    globalThis.fetch = async () => new Response('<html>maintenance</html>',{status:503});
    await assert.rejects(api.getModels(), error => error.status===503 && /restarting/.test(error.message));
    // Paged lists expose the full count from X-Total-Count; state-changing calls send the CSRF header.
    globalThis.fetch = async () => Response.json([{id:1}],{headers:{'X-Total-Count':'42'}});
    assert.deepEqual(await api.getModelsPage({page:2,pageSize:1}), {items:[{id:1}],total:42});
    let sent;
    globalThis.document = { cookie:'other=1; anatolearn_csrf=abc123' };
    globalThis.fetch = async (url, init) => { sent = {url,init}; return Response.json({ok:true}); };
    await api.deleteModel(5);
    assert.equal(sent.init.headers['X-CSRF-Token'],'abc123');
    await api.getModel(5);
    assert.equal(sent.init.headers['X-CSRF-Token'],undefined);
    delete globalThis.document;
  } finally {
    globalThis.fetch=original.fetch;
    if (original.storage===undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage=original.storage;
    if (original.window===undefined) delete globalThis.window; else globalThis.window=original.window;
  }
});
