export const INSIGHT_TOKEN_KEY = "mumei-insight-access-token";
export const APPLICANT_KEY = "mumei-insight-applicant-token";
export const PASSCODE_KEY = "mumei-insight-passcode";
export const ACCOUNT_STORE_KEY = "mumei-insight-saved-accounts-v2";
export const ACCESS_INTENT_KEY = "mumei-insight-access-intent";

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

export function readStoredInsightAccounts(): StoredInsightAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNT_STORE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && cleanId(item.noteId)).map((item) => ({
      noteId: cleanId(item.noteId),
      displayName: typeof item.displayName === "string" ? item.displayName : null,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      status: typeof item.status === "string" ? item.status : "unknown",
      memberToken: typeof item.memberToken === "string" && item.memberToken ? item.memberToken : undefined,
      applicantToken: typeof item.applicantToken === "string" && item.applicantToken ? item.applicantToken : undefined,
      passcode: typeof item.passcode === "string" && item.passcode ? item.passcode : undefined,
      updatedAt: Number(item.updatedAt || 0),
    })).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function write(accounts: StoredInsightAccount[]) {
  localStorage.setItem(ACCOUNT_STORE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new Event("mumei-insight-accounts"));
}

function upsert(next: StoredInsightAccount) {
  const id = cleanId(next.noteId);
  if (!id) return;
  const accounts = readStoredInsightAccounts();
  const old = accounts.find((item) => item.noteId === id);
  const merged: StoredInsightAccount = { ...old, ...next, noteId: id, updatedAt: Date.now() };
  write([merged, ...accounts.filter((item) => item.noteId !== id)].slice(0, 12));
}

export function rememberApplicant(app: any, applicantToken: string) {
  if (!app?.noteId || !applicantToken) return;
  upsert({ noteId: app.noteId, displayName: app.displayName || null, imageUrl: app.imageUrl || null, status: app.status || "pending", applicantToken, updatedAt: Date.now() });
  localStorage.setItem(APPLICANT_KEY, applicantToken);
}

export function rememberApplication(app: any, passcode?: string) {
  if (!app?.noteId) return;
  const applicantToken = localStorage.getItem(APPLICANT_KEY) || undefined;
  upsert({ noteId: app.noteId, displayName: app.displayName || null, imageUrl: app.imageUrl || null, status: app.status || "unknown", applicantToken, passcode: passcode || undefined, updatedAt: Date.now() });
  if (passcode) localStorage.setItem(PASSCODE_KEY, passcode);
}

export function rememberMemberSession(app: any, memberToken: string, passcode?: string) {
  if (!app?.noteId || !memberToken) return;
  const applicantToken = localStorage.getItem(APPLICANT_KEY) || undefined;
  upsert({ noteId: app.noteId, displayName: app.displayName || null, imageUrl: app.imageUrl || null, status: "active", memberToken, applicantToken, passcode: passcode || undefined, updatedAt: Date.now() });
  localStorage.setItem(INSIGHT_TOKEN_KEY, memberToken);
  if (passcode) localStorage.setItem(PASSCODE_KEY, passcode);
}

export function currentStoredInsightAccount() {
  const token = localStorage.getItem(INSIGHT_TOKEN_KEY) || "";
  const applicant = localStorage.getItem(APPLICANT_KEY) || "";
  const accounts = readStoredInsightAccounts();
  return accounts.find((item) => item.memberToken === token && token) || accounts.find((item) => item.applicantToken === applicant && applicant) || accounts[0] || null;
}

export function activateStoredInsightAccount(noteId: string) {
  const account = readStoredInsightAccounts().find((item) => item.noteId === cleanId(noteId));
  if (!account) return null;
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
}

export function setAccessIntent(intent: "login" | "apply" | "switch") {
  sessionStorage.setItem(ACCESS_INTENT_KEY, intent);
}

export function consumeAccessIntent() {
  const value = sessionStorage.getItem(ACCESS_INTENT_KEY) as "login" | "apply" | "switch" | null;
  sessionStorage.removeItem(ACCESS_INTENT_KEY);
  return value;
}
