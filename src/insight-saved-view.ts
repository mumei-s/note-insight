// Display copies are separate from verified views: reading one never refreshes
// its timestamp or authorizes skipping a server check.
const PREFIX = "mumei-insight-data-cache-v1:saved:";
export type InsightSavedScope = { account: string; token: string };
export type InsightSavedView<T> = { value: T; savedAt: number };
const scopeKeys = new Map<string, string>();
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotate = (word: number, bits: number) => (word >>> bits) | (word << (32 - bits));

// SHA-256 over UTF-16LE keeps synchronous display reads independent of optional
// browser crypto/encoder APIs. The credential itself is never written to a copy.
function digest(input: string) {
  const length = input.length * 2, blocks = Math.ceil((length + 9) / 64), words = new Int32Array(blocks * 16);
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i), byte = i * 2;
    words[byte >>> 2] |= (code & 255) << (24 - (byte % 4) * 8);
    words[(byte + 1) >>> 2] |= (code >>> 8) << (24 - ((byte + 1) % 4) * 8);
  }
  words[length >>> 2] |= 128 << (24 - (length % 4) * 8);
  words[words.length - 2] = Math.floor(length / 0x20000000);
  words[words.length - 1] = length * 8;
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Int32Array(64);
  for (let offset = 0; offset < words.length; offset += 16) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = words[offset + i];
      else { const x = w[i - 15], y = w[i - 2]; w[i] = w[i - 16] + (rotate(x,7) ^ rotate(x,18) ^ (x >>> 3)) + w[i - 7] + (rotate(y,17) ^ rotate(y,19) ^ (y >>> 10)); }
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let i = 0; i < 64; i++) {
      const first = (h + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const second = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h=g;g=f;f=e;e=(d+first)|0;d=c;c=b;b=a;a=(first+second)|0;
    }
    [a,b,c,d,e,f,g,h].forEach((word,index) => { hash[index] = (hash[index] + word) | 0; });
  }
  return hash.map(word => (word >>> 0).toString(16).padStart(8,"0")).join("");
}

function normalizedScope(scope: InsightSavedScope) {
  const account = String(scope.account || "").trim().toLowerCase(), token = String(scope.token || "");
  return account && token ? { account, token } : null;
}
export function savedInsightViewKey(kind: string, scope: InsightSavedScope) {
  const normalized = normalizedScope(scope);
  if (!kind || !normalized) return "";
  const identity = JSON.stringify([normalized.account, normalized.token]);
  let stamp = scopeKeys.get(identity);
  if (!stamp) {
    stamp = digest(identity); scopeKeys.set(identity, stamp);
    if (scopeKeys.size > 16) scopeKeys.delete(scopeKeys.keys().next().value!);
  }
  return PREFIX + encodeURIComponent(kind) + ":" + stamp;
}
export function readSavedInsightView<T>(kind: string, scope: InsightSavedScope): InsightSavedView<T> | null {
  const key = savedInsightViewKey(kind, scope);
  if (!key) return null;
  try {
    const copy = JSON.parse(localStorage.getItem(key) || "null");
    if (copy?.version !== 1 || copy.account !== normalizedScope(scope)?.account || copy.key !== key || !Object.prototype.hasOwnProperty.call(copy,"value") || !Number.isFinite(copy.savedAt) || copy.savedAt <= 0 || copy.savedAt > Date.now()) return null;
    return { value: copy.value as T, savedAt: copy.savedAt };
  } catch { return null; }
}
export function writeSavedInsightView<T>(kind: string, scope: InsightSavedScope, value: T, savedAt = Date.now()): void {
  const key = savedInsightViewKey(kind, scope);
  if (!key || !Number.isFinite(savedAt) || savedAt <= 0 || savedAt > Date.now()) return;
  try { localStorage.setItem(key, JSON.stringify({ version: 1, key, account: normalizedScope(scope)!.account, savedAt, value })); } catch { /* Display copies must not block the live view. */ }
}
export function removeSavedInsightView(kind: string, scope: InsightSavedScope): void {
  const key = savedInsightViewKey(kind, scope);
  if (key) try { localStorage.removeItem(key); } catch { /* An unavailable copy is optional. */ }
}
