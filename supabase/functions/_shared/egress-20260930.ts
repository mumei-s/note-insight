// INSIGHT backend-only egress guard. Never clears maintenance or changes billing.
let blockedUntil = 0;
export function quotaError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : JSON.stringify(error);
  return /EGRESS_QUOTA|exceed_egress_quota|Service for this project is restricted/i.test(text || '');
}
export const checkedFetch: typeof fetch = async (input, init) => {
  if (Date.now() < blockedUntil) throw new Error('EGRESS_QUOTA_CIRCUIT_OPEN');
  const response = await fetch(input, init);
  if (response.status === 402) {
    blockedUntil = Date.now() + 60_000;
    await response.body?.cancel();
    throw new Error('EGRESS_QUOTA_HTTP_402');
  }
  return response;
};
export async function rpcValue(db: any, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message || error.code || 'DATABASE_ERROR'}`);
  return data;
}
export async function backgroundGate(db: any, request: Request): Promise<boolean> {
  const secret = request.headers.get('X-Cron-Secret') || '';
  if (!secret) throw new Error('CRON_SECRET_INVALID');
  const state = await rpcValue(db, 'insight_egress_authorize', { p_secret: secret });
  if (state?.authorized !== true) throw new Error('CRON_SECRET_INVALID');
  // A missing control row or malformed response must never start a crawler.
  return state?.maintenance !== false;
}
export async function batchUpsert(db: any, table: string, rows: unknown[]): Promise<number> {
  let changed = 0;
  for (let offset = 0; offset < rows.length; offset += 400) {
    changed += Number(await rpcValue(db, 'insight_egress_upsert', {
      p_table: table, p_rows: rows.slice(offset, offset + 400),
    }) || 0);
  }
  return changed;
}
