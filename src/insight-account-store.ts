export const INSIGHT_TOKEN_KEY = "mumei-insight-access-token";
export const APPLICANT_KEY = "mumei-insight-applicant-token";
export const PASSCODE_KEY = "mumei-insight-passcode";
export const ACCOUNT_STORE_KEY = "mumei-insight-saved-accounts-v3";
export const ACCESS_INTENT_KEY = "mumei-insight-access-intent";
export const ACTIVE_ACCOUNT_KEY = "mumei-insight-active-account-v3";
const LEGACY_ACCOUNT_STORE_KEY = "mumei-insight-saved-accounts-v2";

export type StoredInsightAccount = {
  noteId: string;
  displayName: string | null;
  imageUrl: string | null;
  status: string;
  memberToken?: string;
  applicantToken?: string;
  passcode?: string;
  updatedAt: number;
};

function cleanId(value: unknown) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function normalizeList(input: unknown): StoredInsightAccount[] {
  if (!Array.isArray(input)) return [];
  const map = new Map<string, StoredInsightAccount>();
  for (const raw of input) {
    const id = cleanId(raw?.noteId);
    if (!id) continue;
    const next: StoredInsightAccount = {
      noteId: id,
      displayName: typeof raw?.displayName === "string" ? raw.displayName : null,
      imageUrl: typeof raw?.imageUrl === "string" ? raw.imageUrl : null,
      status: typeof raw?.status === "string" ? raw.status : "unknown",
      memberToken: typeof raw?.memberToken === "string" && raw.memberToken ? raw.memberToken : undefined,
      applicantToken: typeof raw?.applicantToken === "string" && raw.applicantToken ? raw.applicantToken : undefined,
      passcode: typeof raw?.passcode === "string" && raw.passcode ? raw.passcode : undefined,
      updatedAt: Number(raw?.updatedAt || 0),
    };
    const old = map.get(id);
    map.set(id, old && old.updatedAt > next.updatedAt ? { ...next, ...old } : { ...old, ...next });
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readStoredInsightAccounts(): StoredInsightAccount[] {
  try {
    const current = normalizeList(JSON.parse(localStorage.getItem(ACCOUNT_STORE_KEY) || "[]"));
    if (current.length) return current;
    const legacy = normalizeList(JSON.parse(localStorage.getItem(LEGACY_ACCOUNT_STORE_KEY) || "[]"));
    if (legacy.length) {
      localStorage.setItem(ACCOUNT_STORE_KEY, JSON.stringify(legacy));
      return legacy;
    }
    return [];
  } catch {
    return [];
  }
}

function write(accounts: StoredInsightAccount[]) {
  localStorage.setItem(ACCOUNT_STORE_KEY, JSON.stringify(normalizeList(accounts).slice(0, 12)));
  window.dispatchEvent(new Event("mumei-insight-accounts"));
}

function setActiveId(noteId: string) {
  const id = cleanId(noteId);
  if (id) localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

function activeId() {
  return cleanId(localStorage.getItem(ACTIVE_ACCOUNT_KEY) || "");
}

function upsert(next: StoredInsightAccount) {
  const id = cleanId(next.noteId);
  if (!id) return;
  const accounts = readStoredInsightAccounts();
  const old = accounts.find((item) => item.noteId === id);
  const merged: StoredInsightAccount = { ...old, ...next, noteId: id, updatedAt: Date.now() };
  write([merged, ...accounts.filter((item) => item.noteId !== id)]);
}

export function getStoredInsightAccount(noteId: string) {
  const id = cleanId(noteId);
  return readStoredInsightAccounts().find((item) => item.noteId === id) || null;
}

export function rememberApplicant(app: any, applicantToken: string) {
  const noteId = cleanId(app?.noteId);
  if (!noteId || !applicantToken) return;
  upsert({ noteId, displayName: app.displayName || null, imageUrl: app.imageUrl || null, status: app.status || "pending", applicantToken, updatedAt: Date.now() });
  setActiveId(noteId);
  localStorage.setItem(APPLICANT_KEY, applicantToken);
}

export function rememberApplication(app: any, passcode?: string) {
  const noteId = cleanId(app?.noteId);
  if (!noteId) return;
  const existing = getStoredInsightAccount(noteId);
  const applicantToken = existing?.applicantToken || (activeId() === noteId ? localStorage.getItem(APPLICANT_KEY) || undefined : undefined);
  upsert({
    noteId,
    displayName: app.displayName || existing?.displayName || null,
    imageUrl: app.imageUrl || existing?.imageUrl || null,
    status: app.status || existing?.status || "unknown",
    applicantToken,
    passcode: passcode || existing?.passcode,
    updatedAt: Date.now(),
  });
  setActiveId(noteId);
  if (applicantToken) localStorage.setItem(APPLICANT_KEY, applicantToken);
  if (passcode) localStorage.setItem(PASSCODE_KEY, passcode);
}

export function rememberMemberSession(app: any, memberToken: string, passcode?: string) {
  const noteId = cleanId(app?.noteId);
  if (!noteId || !memberToken) return;
  const existing = getStoredInsightAccount(noteId);
  upsert({
    noteId,
    displayName: app.displayName || existing?.displayName || null,
    imageUrl: app.imageUrl || existing?.imageUrl || null,
    status: "active",
    memberToken,
    applicantToken: existing?.applicantToken,
    passcode: passcode || existing?.passcode,
    updatedAt: Date.now(),
  });
  setActiveId(noteId);
  localStorage.setItem(INSIGHT_TOKEN_KEY, memberToken);
  if (existing?.applicantToken) localStorage.setItem(APPLICANT_KEY, existing.applicantToken);
  else localStorage.removeItem(APPLICANT_KEY);
  if (passcode || existing?.passcode) localStorage.setItem(PASSCODE_KEY, passcode || existing!.passcode!);
  else localStorage.removeItem(PASSCODE_KEY);
}

export function currentStoredInsightAccount() {
  const accounts = readStoredInsightAccounts();
  // The actually authenticated member session is the source of truth for the visible current account.
  // A pending secondary application must never replace the visible logged-in identity merely because it was touched last.
  const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  if (token) {
    const selected = accounts.find((item) => item.memberToken === token);
    if (selected) return selected;
  }
  const active = activeId();
  if (active) {
    const selected = accounts.find((item) => item.noteId === active);
    if (selected) return selected;
  }
  const applicant = localStorage.getItem(APPLICANT_KEY) || "";
  if (applicant) {
    const selected = accounts.find((item) => item.applicantToken === applicant);
    if (selected) return selected;
  }
  return null;
}

export function activateStoredInsightAccount(noteId: string) {
  const account = getStoredInsightAccount(noteId);
  if (!account) return null;
  setActiveId(account.noteId);
  if (account.memberToken) localStorage.setItem(INSIGHT_TOKEN_KEY, account.memberToken);
  else localStorage.removeItem(INSIGHT_TOKEN_KEY);
  if (account.applicantToken) localStorage.setItem(APPLICANT_KEY, account.applicantToken);
  else localStorage.removeItem(APPLICANT_KEY);
  if (account.passcode) localStorage.setItem(PASSCODE_KEY, account.passcode);
  else localStorage.removeItem(PASSCODE_KEY);
  upsert({ ...account, updatedAt: Date.now() });
  return account;
}

export function forgetMemberSession(noteId: string) {
  const id = cleanId(noteId);
  const before = readStoredInsightAccounts();
  const removed = before.find((item) => item.noteId === id);
  const accounts = before.map((item) => item.noteId === id ? { ...item, memberToken: undefined, status: item.status === "active" ? "logged-out" : item.status, updatedAt: Date.now() } : item);
  write(accounts);
  if (removed?.memberToken && localStorage.getItem(INSIGHT_TOKEN_KEY) === removed.memberToken) localStorage.removeItem(INSIGHT_TOKEN_KEY);
}

export function forgetInsightAccount(noteId: string) {
  const id = cleanId(noteId);
  const before = readStoredInsightAccounts();
  const removed = before.find((item) => item.noteId === id);
  write(before.filter((item) => item.noteId !== id));
  if (removed?.memberToken && localStorage.getItem(INSIGHT_TOKEN_KEY) === removed.memberToken) localStorage.removeItem(INSIGHT_TOKEN_KEY);
  if (removed?.applicantToken && localStorage.getItem(APPLICANT_KEY) === removed.applicantToken) localStorage.removeItem(APPLICANT_KEY);
  if (activeId() === id) setActiveId("");
}

export function setAccessIntent(intent: "login" | "apply" | "switch") {
  sessionStorage.setItem(ACCESS_INTENT_KEY, intent);
}

export function consumeAccessIntent() {
  const value = sessionStorage.getItem(ACCESS_INTENT_KEY) as "login" | "apply" | "switch" | null;
  sessionStorage.removeItem(ACCESS_INTENT_KEY);
  return value;
}
