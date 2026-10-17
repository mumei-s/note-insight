// A failed lazy import is cached by React until the document is reloaded. Mark
// it so the existing startup boundary can offer a deliberate same-route retry.
export async function loadInsightScreen<T>(load: () => Promise<T>): Promise<T> {
  try { return await load(); }
  catch (cause) {
    const error = new Error("画面ファイルを読み込めませんでした", { cause });
    error.name = "InsightScreenLoadError";
    throw error;
  }
}
