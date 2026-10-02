const DB_NAME="mumei-insight-view-cache-v1";
const STORE="snapshots";

type Stored<T>={key:string;updatedAt:number;value:T};

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("IDB_OPEN_FAILED"));
  });
}

export async function readInsightSnapshot<T>(key:string):Promise<T|null>{
  if(typeof indexedDB==="undefined"||!key)return null;
  try{
    const db=await openDb();
    return await new Promise<T|null>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(key);
      req.onsuccess=()=>resolve((req.result as Stored<T>|undefined)?.value??null);
      req.onerror=()=>reject(req.error||new Error("IDB_READ_FAILED"));
      tx.oncomplete=()=>db.close();
    });
  }catch{return null}
}

export async function writeInsightSnapshot<T>(key:string,value:T):Promise<void>{
  if(typeof indexedDB==="undefined"||!key)return;
  try{
    const db=await openDb();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put({key,updatedAt:Date.now(),value} satisfies Stored<T>);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("IDB_WRITE_FAILED"));
      tx.onabort=()=>reject(tx.error||new Error("IDB_WRITE_ABORTED"));
    });
    db.close();
  }catch{}
}

export async function removeInsightSnapshot(key:string):Promise<void>{
  if(typeof indexedDB==="undefined"||!key)return;
  try{
    const db=await openDb();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("IDB_DELETE_FAILED"));
    });
    db.close();
  }catch{}
}
