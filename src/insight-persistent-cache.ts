const DB_NAME="mumei-insight-view-cache-v1";
const STORE="snapshots";
const OPEN_TIMEOUT=1500;
const TRANSACTION_TIMEOUT=3000;
type Stored<T>={key:string;updatedAt:number;value:T};

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);let settled=false;
    const fail=(error:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)};
    const timer=setTimeout(()=>fail(new Error("IDB_OPEN_TIMEOUT")),OPEN_TIMEOUT);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"})};
    req.onsuccess=()=>{if(settled){req.result.close();return}settled=true;clearTimeout(timer);resolve(req.result)};
    req.onerror=()=>fail(req.error||new Error("IDB_OPEN_FAILED"));
    req.onblocked=()=>fail(new Error("IDB_OPEN_BLOCKED"));
  });
}

async function transaction<T>(mode:IDBTransactionMode, action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDb();
  try{
    return await new Promise<T>((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);let value:T,settled=false;
      const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value)};
      const timer=setTimeout(()=>{finish(new Error("IDB_TRANSACTION_TIMEOUT"));try{tx.abort()}catch{}},TRANSACTION_TIMEOUT);
      tx.oncomplete=()=>finish();
      tx.onerror=tx.onabort=()=>finish(tx.error||new Error("IDB_TRANSACTION_FAILED"));
      try{
        const req=action(tx.objectStore(STORE));
        req.onsuccess=()=>{value=req.result};
        req.onerror=()=>{finish(req.error||new Error("IDB_REQUEST_FAILED"));try{tx.abort()}catch{}};
      }catch(error){finish(error);try{tx.abort()}catch{}}
    });
  }finally{db.close()}
}

// Preserve invocation order for a key even when opening IndexedDB is delayed.
// A failed operation cannot block later reads, saves or explicit removals.
const pending=new Map<string,Promise<unknown>>();
function ordered<T>(key:string,action:()=>Promise<T>):Promise<T>{
  const result=(pending.get(key)||Promise.resolve()).catch(()=>{}).then(action);
  pending.set(key,result);
  void result.finally(()=>{if(pending.get(key)===result)pending.delete(key)}).catch(()=>{});
  return result;
}
export async function readInsightSnapshot<T>(key:string):Promise<T|null>{
  if(typeof indexedDB==="undefined"||!key)return null;
  try{return await ordered(key,async()=> (await transaction<Stored<T>|undefined>("readonly",store=>store.get(key)))?.value??null)}catch{return null}
}
export async function writeInsightSnapshot<T>(key:string,value:T):Promise<void>{
  if(typeof indexedDB==="undefined"||!key)return;
  try{await ordered(key,()=>transaction("readwrite",store=>store.put({key,updatedAt:Date.now(),value} satisfies Stored<T>)))}catch{}
}
export async function removeInsightSnapshot(key:string):Promise<void>{
  if(typeof indexedDB==="undefined"||!key)return;
  try{await ordered(key,()=>transaction("readwrite",store=>store.delete(key)))}catch{}
}
