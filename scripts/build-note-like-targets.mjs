import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEFAULT_SOURCE = 'https://note.com/ss_yr/n/n59d52f416a66';
const DEFAULT_TAIL = 'https://note.com/fuku444/n/nb4f6934381e9';
const DEFAULT_DELAY_MS = 700;
const DEFAULT_BATCH_SIZE = 20;

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    tail: DEFAULT_TAIL,
    out: 'tmp/note-like-batch',
    delayMs: DEFAULT_DELAY_MS,
    batchSize: DEFAULT_BATCH_SIZE,
    resume: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--source') args.source = argv[++i];
    else if (value === '--tail') args.tail = argv[++i];
    else if (value === '--out') args.out = argv[++i];
    else if (value === '--delay-ms') args.delayMs = Number(argv[++i]);
    else if (value === '--batch-size') args.batchSize = Number(argv[++i]);
    else if (value === '--no-resume') args.resume = false;
    else if (value === '--help' || value === '-h') {
      process.stdout.write(`usage: node scripts/build-note-like-targets.mjs [options]\n\n--source URL       スキ取得元の記事URL\n--tail URL         最後に1件だけ追加する記事URL\n--out DIR          出力先 (default: tmp/note-like-batch)\n--delay-ms N       note API間隔ms (default: ${DEFAULT_DELAY_MS})\n--batch-size N     1回に処理するクリエイター数 (default: ${DEFAULT_BATCH_SIZE})\n--no-resume        保存済みstateを使わず最初から\n`);
      process.exit(0);
    } else {
      throw new Error(`未知の引数: ${value}`);
    }
  }
  if (!Number.isSafeInteger(args.delayMs) || args.delayMs < 300) throw new Error('--delay-ms は300以上');
  if (!Number.isSafeInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 50) {
    throw new Error('--batch-size は1〜50');
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function noteKey(url) {
  const match = String(url || '').match(/^https:\/\/note\.com\/[A-Za-z0-9_]+\/n\/(n[a-f0-9]{12})(?:[?#].*)?$/i);
  if (!match) throw new Error(`記事URL不正: ${url}`);
  return match[1];
}

function jstDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function recentJstDays(now = new Date()) {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  const today = shifted.toISOString().slice(0, 10);
  const yesterday = new Date(shifted.getTime() - 86400000).toISOString().slice(0, 10);
  return new Set([today, yesterday]);
}

function getPublishAt(item) {
  return item?.publish_at ?? item?.publishAt ?? item?.published_at ?? item?.publishedAt ?? null;
}

function getNoteUrl(item, urlname) {
  const key = item?.key ?? item?.note_key ?? item?.noteKey;
  if (!key) return null;
  return `https://note.com/${urlname}/n/${key}`;
}

function normalizeContents(payload) {
  const data = payload?.data ?? payload ?? {};
  const contents = data?.contents ?? data?.notes ?? [];
  return Array.isArray(contents) ? contents : [];
}

async function requestJson(url, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/plain,*/*',
          'user-agent': 'MumeiNoteBatchBuilder/3.0 (+read-only; conservative-rate)',
        },
        redirect: 'follow',
      });
      if (response.status === 403 || response.status === 429) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.stopImmediately = true;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.retryable = response.status >= 500 || response.status === 408;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error?.stopImmediately || !error?.retryable || attempt >= retries) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

function extractLikers(payload) {
  const data = payload?.data ?? payload ?? {};
  const likes = data?.likes ?? data?.contents ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(likes)) return [];
  return likes
    .map((like) => like?.user ?? like)
    .map((user) => ({
      key: String(user?.key ?? user?.id ?? ''),
      urlname: String(user?.urlname ?? user?.name ?? '').trim(),
      nickname: String(user?.nickname ?? user?.display_name ?? '').trim(),
    }))
    .filter((user) => /^[A-Za-z0-9_]+$/.test(user.urlname));
}

function likesIsLastPage(payload, count) {
  const data = payload?.data ?? payload ?? {};
  if (typeof payload?.is_last_page === 'boolean') return payload.is_last_page;
  if (typeof payload?.isLastPage === 'boolean') return payload.isLastPage;
  if (typeof data?.is_last_page === 'boolean') return data.is_last_page;
  if (typeof data?.isLastPage === 'boolean') return data.isLastPage;
  const next = payload?.next_page ?? data?.next_page ?? payload?.nextPage ?? data?.nextPage;
  if (next === null || next === false) return true;
  return count === 0;
}

async function fetchAllLikers(sourceUrl, delayMs) {
  const key = noteKey(sourceUrl);
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`https://note.com/api/v3/notes/${key}/likes`);
    url.searchParams.set('page', String(page));
    const payload = await requestJson(url);
    const likers = extractLikers(payload);
    for (const liker of likers) {
      if (!seen.has(liker.urlname)) {
        seen.add(liker.urlname);
        all.push(liker);
      }
    }
    if (likesIsLastPage(payload, likers.length)) break;
    await sleep(delayMs);
  }
  return all;
}

async function fetchCreatorContents(urlname, disabledPinned) {
  const url = new URL(`https://note.com/api/v2/creators/${encodeURIComponent(urlname)}/contents`);
  url.searchParams.set('kind', 'note');
  url.searchParams.set('page', '1');
  url.searchParams.set('per', '6');
  url.searchParams.set('disabled_pinned', disabledPinned ? 'true' : 'false');
  url.searchParams.set('with_notes', 'false');
  return normalizeContents(await requestJson(url));
}

function pinnedCandidate(withPinned, actualLatest) {
  if (!withPinned.length) return null;
  const latestKey = actualLatest?.key ?? actualLatest?.note_key ?? actualLatest?.noteKey;
  const first = withPinned[0];
  const firstKey = first?.key ?? first?.note_key ?? first?.noteKey;
  if (firstKey && latestKey && firstKey !== latestKey) return first;
  if (first?.is_pinned === true || first?.isPinned === true || first?.pinned === true) return first;
  return null;
}

async function selectTarget(liker, recentDays) {
  const [withoutPinned, withPinned] = await Promise.all([
    fetchCreatorContents(liker.urlname, true),
    fetchCreatorContents(liker.urlname, false),
  ]);
  const actualLatest = withoutPinned[0] ?? withPinned[0] ?? null;
  const pinned = pinnedCandidate(withPinned, actualLatest);
  const latestDay = actualLatest ? jstDay(getPublishAt(actualLatest)) : null;

  let selected = null;
  let reason = null;
  if (actualLatest && latestDay && recentDays.has(latestDay)) {
    selected = actualLatest;
    reason = 'recent_latest';
  } else if (pinned) {
    selected = pinned;
    reason = 'pinned_fallback';
  } else if (actualLatest) {
    selected = actualLatest;
    reason = 'latest_fallback';
  }
  if (!selected) {
    return { ...liker, status: 'no_public_article', reason: 'none', selectedUrl: null };
  }
  return {
    ...liker,
    status: 'selected',
    reason,
    selectedUrl: getNoteUrl(selected, liker.urlname),
    selectedKey: selected?.key ?? null,
    title: selected?.name ?? selected?.title ?? '',
    publishAt: getPublishAt(selected),
  };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function saveState(file, state) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`);
  await fs.rename(tmp, file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  noteKey(args.source);
  if (args.tail) noteKey(args.tail);

  const outDir = path.resolve(ROOT, args.out);
  const stateFile = path.join(outDir, 'state.json');
  const targetsFile = path.join(outDir, 'targets.txt');
  const previewFile = path.join(outDir, 'preview.json');
  await fs.mkdir(outDir, { recursive: true });

  let state = args.resume ? await readJson(stateFile, null) : null;
  if (state && state.sourceUrl !== args.source) {
    throw new Error(`stateのsourceUrlが違います: ${state.sourceUrl}`);
  }
  if (!state) {
    const likers = await fetchAllLikers(args.source, args.delayMs);
    state = {
      version: 1,
      sourceUrl: args.source,
      tailUrl: args.tail || null,
      createdAt: new Date().toISOString(),
      recentDays: [...recentJstDays()],
      cursor: 0,
      likers,
      results: [],
      usedUrls: [],
      blocked: null,
    };
    await saveState(stateFile, state);
  }

  const recentDays = new Set(state.recentDays);
  const usedUrls = new Set(state.usedUrls || []);
  const end = Math.min(state.cursor + args.batchSize, state.likers.length);

  for (let i = state.cursor; i < end; i += 1) {
    const liker = state.likers[i];
    try {
      const result = await selectTarget(liker, recentDays);
      if (result.selectedUrl && usedUrls.has(result.selectedUrl)) {
        result.status = 'duplicate_article';
        result.reason = `${result.reason}_duplicate`;
      } else if (result.selectedUrl) {
        usedUrls.add(result.selectedUrl);
      }
      state.results.push(result);
      state.cursor = i + 1;
      state.usedUrls = [...usedUrls];
      state.updatedAt = new Date().toISOString();
      await saveState(stateFile, state);
      process.stdout.write(`[${state.cursor}/${state.likers.length}] ${liker.urlname} -> ${result.selectedUrl ?? '-'} (${result.reason})\n`);
      if (state.cursor < end) await sleep(args.delayMs);
    } catch (error) {
      state.blocked = {
        atIndex: i,
        urlname: liker.urlname,
        status: error?.status ?? null,
        message: String(error?.message ?? error),
        stoppedAt: new Date().toISOString(),
      };
      state.updatedAt = new Date().toISOString();
      await saveState(stateFile, state);
      if (error?.status === 403 || error?.status === 429) {
        throw new Error(`STOP HTTP ${error.status}: ${liker.urlname}. 自動再試行しません。state保存済み`);
      }
      throw error;
    }
  }

  state.blocked = null;
  state.updatedAt = new Date().toISOString();
  await saveState(stateFile, state);

  const selected = state.results.filter((item) => item.status === 'selected' && item.selectedUrl);
  const urls = selected.map((item) => item.selectedUrl);
  if (args.tail && !urls.includes(args.tail)) urls.push(args.tail);

  await fs.writeFile(targetsFile, `${urls.join('\n')}${urls.length ? '\n' : ''}`);

  const summary = {
    sourceUrl: args.source,
    recentDays: state.recentDays,
    likerCount: state.likers.length,
    processedCount: state.cursor,
    remainingCount: Math.max(0, state.likers.length - state.cursor),
    selectedCount: selected.length,
    recentLatest: selected.filter((item) => item.reason === 'recent_latest').length,
    pinnedFallback: selected.filter((item) => item.reason === 'pinned_fallback').length,
    latestFallback: selected.filter((item) => item.reason === 'latest_fallback').length,
    duplicateArticles: state.results.filter((item) => item.status === 'duplicate_article').length,
    noPublicArticle: state.results.filter((item) => item.status === 'no_public_article').length,
    tailAdded: Boolean(args.tail && urls.includes(args.tail)),
    targetCount: urls.length,
    complete: state.cursor >= state.likers.length,
    nextCommand: state.cursor < state.likers.length
      ? `node scripts/build-note-like-targets.mjs --source ${args.source} --out ${args.out} --batch-size ${args.batchSize}`
      : null,
    items: state.results,
  };
  await fs.writeFile(previewFile, `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write(`PREVIEW ${state.cursor}/${state.likers.length} targets=${urls.length} complete=${summary.complete}\n`);
  process.stdout.write(`targets: ${path.relative(ROOT, targetsFile)}\n`);
}

await main();
