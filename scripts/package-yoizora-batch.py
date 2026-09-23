import base64, collections, datetime, hashlib, html, json, pathlib, struct, sys, zipfile

p=pathlib.Path(sys.argv[1]); data=json.loads((p/'yoizora-ready.json').read_text()); rows=data['rows']
api=p/'api-cache'
def cached(url):
    value=json.loads((api/(hashlib.sha256(url.encode()).hexdigest()+'.json')).read_text())
    return value.get('data',value)
def content(who,pinned):return cached(f'/api/v2/creators/{who}/contents?kind=note&page=1&disabled_pinned={"false" if pinned else "true"}&with_notes=false').get('contents',[])
def unwrap(n):return n.get('note',n)
def stamp(n):return datetime.datetime.fromisoformat(n.get('publishAt') or n.get('publish_at')).astimezone(datetime.timezone(datetime.timedelta(hours=9)))
people=json.loads((p/'people.json').read_text());clock=datetime.datetime.fromisoformat(data['createdAt']);days={clock.date(),(clock-datetime.timedelta(days=1)).date()}
assert len(rows)==data['count']==len(set(r['urlname'] for r in rows))==len(set(r['url'] for r in rows))
assert rows[-1]['url']=='https://note.com/fuku444/n/nb4f6934381e9' and rows[-1]['finalMarker']
rest=False
for i,r in enumerate(rows,1):
    assert r['index']==i
    n=cached('/api/v3/notes/'+r['latestKey']);u=n['user'];name=str(u.get('nickname') or u.get('name') or '').strip()
    assert u['urlname']==r['urlname'] and n['key']==r['latestKey']
    assert r['url']==f'https://note.com/{r["urlname"]}/n/{n["key"]}'
    assert r['creator']==name and r['caption']==name+'さん'
    assert r['creatorVerified']['name']==name and r['creatorVerified']['articleKey']==n['key']
    if r.get('finalMarker'):continue
    c=people[r['urlname']]
    if c.get('tagKey'):
        assert not rest and r['articleSource']=='hashtag' and r['latestKey']==c['tagKey']
    else:
        rest=True;recent=[unwrap(n) for n in content(r['urlname'],False)];hits=[n for n in recent if stamp(n).date() in days]
        if hits:chosen=max(hits,key=stamp);origin='todayYesterday'
        else:
            fixed=[unwrap(n) for n in content(r['urlname'],True) if unwrap(n).get('isPinned') is True or unwrap(n).get('is_pinned') is True]
            chosen=fixed[0] if fixed else recent[0];origin='fixedFallback' if fixed else 'latestFallback'
        assert chosen['key']==r['latestKey'],r['urlname']
        assert origin==r['articleSource'],r['urlname']
for r in rows:
    b=base64.b64decode(r['pngBase64']);assert b[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',b[16:24])==(860,140)
    assert hashlib.sha256(b).hexdigest()==r['pngSha256']
    assert b==(p/'cards'/f'{r["index"]:03}.png').read_bytes()
included={r['urlname'] for r in rows};excluded={x['excluded'] for x in data['excluded']}
assert set(people)-{'fuku444'}==(included-{'fuku444'})|excluded
counts=collections.Counter(r['articleSource'] for r in rows)
report={'count':len(rows),'types':dict(counts),'excluded':data['excluded'],'captionVerified':len(rows),'imageHashVerified':len(rows),'dimensions':'860x140','duplicates':0,'last':rows[-1]['url'],'asOf':data['createdAt']}
(p/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
esc=html.escape
figures='\n'.join(f'<figure><a href="{esc(r["url"])}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" width="860" height="140" src="cards/{r["index"]:03}.png" alt="{esc(r["title"])}"></a><figcaption>{r["index"]}. {esc(r["caption"])} <small>｜{esc(r["articleSource"])}</small></figcaption></figure>' for r in rows)
preview='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>宵空カップ 完成一覧</title><style>body{font-family:system-ui,sans-serif;margin:20px auto;max-width:860px;padding:0 10px;color:#17212b}figure{margin:24px 0}img{max-width:100%;height:auto}figcaption{text-align:center;font-size:14px}small{color:#667}</style><h1>宵空カップ 完成一覧</h1><p>'+str(len(rows))+'件。#先頭・人物の重複なし・最後は実績の算数。全件、投稿者ID・記事キー・氏名・PNGを照合済み。</p><p>今日／昨日 → 固定（古くても可）→ 最新。取得基準：'+esc(data['createdAt'])+'</p>'+figures+'</html>'
(p/'preview.html').write_text(preview)
readme='''極薄＋通知 v18.8.3 宵空カップ用

1. 更新ページからツールを更新し、note下書きの保存完了後に編集画面を開き直す。
2. 前回の画像が残る場合は「初期化」。
3. 「宵空セット」を押す。公開データを取れない場合だけ「データ読込」でyoizora-ready.jsonを選ぶ。
4. 画像・リンク・名前＋さんの保存完了後「送」。
5. noteで公開して通知後「削」で今回の標準カードだけを一括削除し、記事を更新。

preview.htmlは全件の画像とキャプションの確認用。画像をタップすると対応する記事へ移動。
cards/ は独立した860×140 PNG。yoizora-ready.jsonは対応情報と全画像入りの完成データ。
事前作成済みデータは40枚ずつ連続投入。スマホで画像を描き直しません。
元本文は保持し、自動公開・自動再読込は行いません。
Android実機での300枚以上の再成功は未確認です。通信・保存失敗時は記録を残して停止します。
'''
(p/'README.txt').write_text(readme)
zip_path=p.parent/'yoizora-cards-1883.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for name in ['yoizora-ready.json','preview.html','README.txt','verification.json']:z.write(p/name,name)
    for r in rows:z.write(p/'cards'/f'{r["index"]:03}.png',f'cards/{r["index"]:03}.png')
print(json.dumps(report,ensure_ascii=False));print(zip_path,zip_path.stat().st_size)
