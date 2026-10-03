import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(path, 'utf8');
const release = JSON.parse(read('public/insight-release.json'));
for (const [file, field] of [['public/note-insight-dm.user.js', 'dmVersion'], ['public/note-insight-notification-v3.user.js', 'notificationVersion']]) {
  test(file + 'の公開版・導入報告・依存ファイルの更新を揃える', () => {
    const wrapper = read(file), meta = wrapper.match(/@version\s+(\S+)/)[1], runtime = wrapper.match(/const VERSION='([^']+)'/)[1];
    assert.equal(meta, release[field]);
    assert.equal(runtime, release[field]);
    for (const dependency of wrapper.matchAll(/@require\s+https:\/\/raw\.githubusercontent\.com\/mumei-s\/note-insight\/main\/(public\/note-insight-(?:dm-reader-v1|notification-filter-v4|notification-controls-v1)\.js)\?v=(\d+)/g)) {
      const version = read(dependency[1]).match(/const VERSION='([^']+)'/)[1];
      assert.equal(dependency[2], version.replaceAll('.', ''), dependency[1] + 'の古いrequireキャッシュを更新');
    }
  });
}
