type EventRow = { is_creator?: unknown; is_root?: unknown; parent_key?: unknown; comment_key?: unknown };
type HeartResult = { rootKey?: unknown; replyKey?: unknown; status?: unknown; exact?: unknown; counterpartHearted?: unknown; counterpartName?: unknown };

export function visibleReplyHeartRoots(rows: readonly EventRow[], seen: ReadonlySet<string>): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const parent = String(row.parent_key || "");
    if (row.is_creator === true && row.is_root !== true && row.comment_key && parent && !seen.has(parent)) keys.add(parent);
  }
  return [...keys];
}

export function counterpartHeartForReply(row: EventRow, heart?: HeartResult): string | null {
  if (row.is_creator !== true || row.is_root === true || !row.comment_key || !row.parent_key) return null;
  if (heart?.exact !== true || heart.counterpartHearted !== true || heart.status !== "creator_reply_last") return null;
  if (String(heart.rootKey || "") !== String(row.parent_key) || String(heart.replyKey || "") !== String(row.comment_key)) return null;
  return String(heart.counterpartName || "").trim() || null;
}
