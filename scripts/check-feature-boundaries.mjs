import { execFileSync } from 'node:child_process';

const support = (p) =>
  /^tests\//.test(p) ||
  /^docs\//.test(p) ||
  /^scripts\//.test(p) ||
  /^\.github\//.test(p) ||
  /^(package|tsconfig|vite\.)/.test(p) ||
  p === 'public/insight-release.json' ||
  p === 'src/insight-release.ts' ||
  p === 'public/note-insight-notification-v3.user.js';

const rules = [
  ['notification-installer', (p) => p === 'public/notification-browser-install.html' || p === 'public/tool-setup.html' || /^public\/notification-(?:install|update|entry).*\.html$/.test(p)],
  ['notification-filter-settings', (p) => p === 'public/notification-filter-settings.html' || p === 'public/notification-filter.html'],
  ['notification-reader', (p) => /^public\/note-insight-notification-(?:reader|autoscan)/.test(p)],
  ['notification-checkpoint', (p) => /^public\/note-insight-notification-checkpoint/.test(p)],
  ['notification-shell', (p) => /^public\/note-insight-notification-(?:runtime|dock-watch|fixed-dock|launcher|surface-guard|settings-route|loader)/.test(p)],
  ['notification-insight-ui', (p) => /^src\/(?:insight-notification-ui|member-insight-notifications)/.test(p)],
  ['notification-backend', (p) => /^supabase\/functions\/insight-notification-/.test(p)],
  ['dashboard', (p) => /(?:^|\/)(?:insight-)?dashboard/i.test(p) || /note-insight-dashboard/i.test(p)],
  ['auth-access', (p) => /^src\/(?:access-portal|insight-account-store)/.test(p) || /^supabase\/functions\/(?:insight-access|insight-access-reactivate|insight-code-login|insight-self-account)/.test(p)],
  ['directory-catalog', (p) => p === 'public/directory-member.html' || /^src\/catalog-/.test(p) || /^supabase\/functions\/insight-participants/.test(p)],
  ['favorites', (p) => /favorite/i.test(p)],
  ['games', (p) => /(?:^|\/)(?:game-|creator-world-game|match-game|creator-game-data)/i.test(p)],
  ['comments', (p) => /member-insight-comments|insight-comment-/i.test(p)],
  ['social', (p) => /member-insight-social|insight-social/i.test(p)],
  ['analysis', (p) => /member-insight-(?:analysis|analytics|completeness|opportunity)/i.test(p)],
  ['membership', (p) => /insight-member-(?:extras|history)|member-portal/i.test(p)],
];

function classify(p) {
  if (support(p)) return null;
  for (const [name, match] of rules) if (match(p)) return name;
  if (/^(public|src|supabase\/functions)\//.test(p)) return 'unclassified:' + p;
  return null;
}

let files = [];
try {
  files = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { encoding: 'utf8' })
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
} catch {
  console.log('feature-boundary: no parent commit; skipped');
  process.exit(0);
}

const grouped = new Map();
for (const file of files) {
  const group = classify(file);
  if (!group) continue;
  if (!grouped.has(group)) grouped.set(group, []);
  grouped.get(group).push(file);
}

if (grouped.size > 1) {
  console.error('\nFEATURE BOUNDARY VIOLATION');
  console.error('1回の更新で複数機能の本体ファイルが変更されています。機能ごとにコミットを分けてください。\n');
  for (const [group, list] of grouped) {
    console.error('[' + group + ']');
    for (const file of list) console.error('  - ' + file);
  }
  console.error('\n許可: 対象機能1つ + tests/docs/release metadata/shared wrapper。');
  process.exit(1);
}

const only = [...grouped.keys()][0] || 'support-only';
console.log('feature-boundary: OK -> ' + only);
