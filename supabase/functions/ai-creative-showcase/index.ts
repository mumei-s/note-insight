const MAGAZINE_KEY = "m95b78222e9b9";
const NOTE_BASE = "https://note.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const jsonHeaders = {
  ...cors,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900",
};
async function noteJson(path: string) {
  const res = await fetch(`${NOTE_BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; AI-Creative-Showcase/1.0)" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`note ${path} -> ${res.status}`);
  return await res.json();
}
function compactProfile(data: any, fallback: any) {
  return {
    id: data?.id ?? fallback?.id ?? null,
    key: data?.key ?? fallback?.key ?? null,
    urlname: data?.urlname ?? fallback?.urlname ?? "",
    nickname: data?.nickname ?? fallback?.nickname ?? fallback?.urlname ?? "",
    profile: data?.profile ?? "",
    image: data?.user_profile_image_url ?? data?.userProfileImagePath ?? data?.profile_image_path ?? fallback?.userProfileImagePath ?? "",
    customDomain: data?.custom_domain ?? data?.customDomain ?? fallback?.customDomain ?? null,
  };
}
function classifyWork(text: string) {
  const s = text.toLowerCase();
  if (/suno|音楽|楽曲|music|曲|歌詞|mv/.test(s)) return "AI MUSIC";
  if (/動画|video|movie|pollo|minimax|h3|映像/.test(s)) return "AI VIDEO";
  if (/プロンプト|prompt/.test(s)) return "PROMPT / RECIPE";
  if (/3d|フィギュア|制作|メイキング|making/.test(s)) return "MAKING / CRAFT";
  if (/イラスト|画像|image|art|絵|ドレス|visual/.test(s)) return "AI VISUAL";
  return "CREATIVE NOTE";
}
function scoreWork(note: any) {
  const text = `${note?.name ?? ""} ${note?.body ?? ""}`.toLowerCase();
  let score = note?.eyecatch ? 20 : 0;
  if (/ai|生成|創作|イラスト|画像|動画|音楽|suno|pollo|prompt|プロンプト|3d|フィギュア/.test(text)) score += 15;
  if (note?.user?.urlname && note.user.urlname !== "ss_yr") score += 8;
  return score;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: jsonHeaders });
  try {
    const layoutJson = await noteJson(`/api/v1/layout/magazine/${MAGAZINE_KEY}`);
    const layout = layoutJson?.data?.magazine_layout;
    if (!layout) throw new Error("magazine layout missing");
    const editors: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const pageJson = await noteJson(`/api/v2/magazines/${MAGAZINE_KEY}/editors?page=${page}`);
      const data = pageJson?.data ?? {};
      const rows = Array.isArray(data.editors) ? data.editors : [];
      editors.push(...rows);
      if (data.is_last_page === true || data.isLastPage === true || rows.length === 0) break;
    }
    const uniqueEditors = Array.from(new Map(editors.map((e: any) => [e.urlname || e.key || String(e.id), e])).values());
    const profiles = await Promise.all(uniqueEditors.map(async (editor: any) => {
      try {
        const p = await noteJson(`/api/v2/creators/${encodeURIComponent(editor.urlname)}`);
        return compactProfile(p?.data, editor);
      } catch {
        return compactProfile(null, editor);
      }
    }));
    const contents = Array.isArray(layout?.page_layout?.section?.contents) ? layout.page_layout.section.contents : [];
    const usedImages = new Set<string>();
    const usedCreators = new Set<string>();
    const artworks = contents.filter((n: any) => n?.eyecatch).sort((a: any, b: any) => scoreWork(b) - scoreWork(a)).filter((n: any) => {
      const image = String(n.eyecatch || "");
      if (!image || usedImages.has(image)) return false;
      const creator = String(n?.user?.urlname || "");
      if (usedCreators.has(creator) && usedCreators.size < 6) return false;
      usedImages.add(image);
      if (creator) usedCreators.add(creator);
      return true;
    }).slice(0, 8).map((n: any) => ({
      key: n.key,
      title: n.name ?? "",
      body: n.body ?? "",
      eyecatch: n.eyecatch,
      publishAt: n.publish_at,
      likeCount: n.like_count ?? 0,
      creator: { urlname: n?.user?.urlname ?? "", nickname: n?.user?.nickname ?? n?.user?.name ?? "" },
      category: classifyWork(`${n.name ?? ""} ${n.body ?? ""}`),
    }));
    return new Response(JSON.stringify({
      ok: true,
      fetchedAt: new Date().toISOString(),
      magazine: {
        key: layout.key,
        name: layout.name,
        description: layout.description,
        noteCount: layout.note_count,
        editorsCount: layout.editors_count ?? profiles.length,
        updatedAt: layout.updated_at,
        cover: layout.cover_original ?? layout.cover_rectangle ?? layout.cover,
        coverLandscape: layout.cover_landscape ?? layout.cover_rectangle ?? layout.cover,
        url: layout.magazine_url ?? `https://note.com/ss_yr/m/${MAGAZINE_KEY}`,
      },
      members: profiles,
      artworks,
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), { status: 502, headers: { ...jsonHeaders, "Cache-Control": "no-store" } });
  }
});
