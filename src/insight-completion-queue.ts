type Completion = {
  desired: boolean;
  acknowledged: boolean;
  write: (value: boolean) => Promise<unknown>;
  current: () => boolean;
  settled: (value: boolean, failed: boolean) => void;
};

// Keep each row's writes in order, while every tap updates the screen immediately.
// A slow response must never replace a newer choice, including a quick undo.
const writes = new Map<string, Completion>();
export function pendingCompletion(key: string) { return writes.get(key)?.desired; }
export function queueCompletion(key: string, before: boolean, desired: boolean,
  write: Completion["write"], current: Completion["current"], settled: Completion["settled"]) {
  const existing = writes.get(key);
  if (existing) { existing.desired = desired; existing.settled = settled; return; }
  const entry: Completion = { desired, acknowledged: before, write, current, settled };
  writes.set(key, entry);
  void (async () => {
    try {
      while (entry.current()) {
        const sent = entry.desired;
        try {
          await entry.write(sent);
          entry.acknowledged = sent;
        } catch {
          if (!entry.current()) return;
          if (entry.desired !== sent) continue;
          entry.settled(entry.acknowledged, true);
          return;
        }
        if (!entry.current()) return;
        if (entry.desired !== sent) continue;
        entry.settled(sent, false);
        return;
      }
    } finally { writes.delete(key); }
  })();
}
