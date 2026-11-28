export {example} from './protected-example.mjs';

export const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f8f6f1"><meta name="robots" content="noindex,nofollow">
<title>note制作の検閲キット｜無名S</title><link rel="stylesheet" href="/ui.css"><script src="/ui.js" defer></script></head>
<body>
<a class="skip" href="#main">本文へ移動</a>
<header class="mast"><div class="mast-inner"><div class="brand"><span class="mark" aria-hidden="true"><i></i></span>note制作の検閲キット</div><nav aria-label="利用メニュー"><span class="viewer" id="identity" hidden></span><a id="ownerLink" href="/owner" hidden>利用管理</a><button class="underlink" id="logout" type="button" hidden>ログアウト</button></nav></div></header>
<main id="main" tabindex="-1">
<noscript><p>このツールを開くにはブラウザーのJavaScriptを有効にしてください。</p></noscript>
<section class="center paper" id="loading" aria-labelledby="loading-title"><h1 id="loading-title" tabindex="-1">利用状況の確認</h1><p id="loadingText">接続しています…</p><button id="retryLoad" type="button" hidden>もう一度読み込む</button></section>

<section class="gate" id="entry" hidden aria-labelledby="entry-title">
<div class="introduction"><p class="byline">無名S の執筆道具</p><h1 id="entry-title" tabindex="-1">原稿の<br>点検室<span class="fullstop">。</span></h1><p class="lede">下書きと根拠を並べて、<br>直す一文と、人が確かめる場所を見つける。</p>
<div class="mini-flow"><h2>初回の利用手順</h2><ol><li>有料記事の合言葉を入力</li><li>noteプロフィールで本人確認</li><li>購入・メンバー利用の照合後に開始</li></ol></div></div>
<div class="paper gate-form"><p class="section-label">利用手続き</p><h2 id="loginTitle">ツールを開く</h2><p>記事を読んでいるnoteアカウントで進んでください。</p>
<form id="entryForm"><label for="noteId">note ID</label><input id="noteId" name="username" maxlength="33" placeholder="例：mumei_s" autocomplete="username" autocapitalize="none" spellcheck="false" required aria-describedby="noteHint"><small id="noteHint">プロフィールの「note.com/」に続く文字です。</small>
<label for="passcode">有料記事の合言葉</label><input id="passcode" name="entry-code" type="password" autocomplete="off" spellcheck="false" required>
<div id="ownerField" hidden><label for="ownerKey">管理用の合言葉</label><input id="ownerKey" name="owner-key" type="password" autocomplete="off"></div>
<button class="primary wide" type="submit">確認コードを発行する<span aria-hidden="true"> →</span></button><p class="feedback" id="entryMsg" role="status"></p></form></div></section>

<section class="center paper" id="proof" hidden aria-labelledby="proof-title"><p class="section-label">本人確認</p><h1 id="proof-title" tabindex="-1">確認コードを載せる</h1><p><b id="proofUser"></b> のnoteプロフィールを別のタブで開き、自己紹介に次のコードを一時的に貼り付けて保存してください。</p><label class="field-title" for="proofCode">プロフィール用の確認コード</label>
<div class="copyline"><input id="proofCode" readonly spellcheck="false"><button type="button" data-copy-code>コピー</button></div><small id="proofExpiry"></small>
<p><a id="noteProfile" rel="noopener noreferrer" target="_blank">自分のnoteプロフィールを開く ↗</a></p><p>保存したらこの画面に戻ってください。本人確認が終わったら、プロフィールからコードを削除できます。</p><div class="actions"><button type="button" class="primary" id="confirm">保存したので確認する</button><button type="button" class="text-button" id="restart">最初からやり直す</button></div><p class="feedback" id="proofMsg" role="status"></p></section>

<section class="center paper" id="waiting" hidden aria-labelledby="waiting-title"><p class="section-label">利用状況</p><h1 id="waiting-title" tabindex="-1">購入状況を照合中</h1><p id="waitingText"></p><p class="account-note" id="cleanup" hidden>本人確認は完了しました。noteプロフィールから確認コードを削除できます。</p><button type="button" id="refresh" class="primary">利用状況を更新する</button><p class="feedback" id="waitingMsg" role="status"></p></section>

<section id="editor" hidden aria-labelledby="editor-title"><div class="work-heading"><div><p class="section-label">制作ノート</p><h1 id="editor-title" tabindex="-1">原稿を点検する<span class="fullstop">。</span></h1></div><span class="account-note" id="entitlement"></span></div><p id="editorCleanup" class="account-note" hidden>本人確認は完了しました。プロフィールから確認コードを削除できます。</p>
<form id="reviewForm" class="paper workpaper" autocomplete="off"><fieldset><legend>いまの工程</legend><div class="stages"><label><input type="radio" name="stage" value="着手前"><span>着手前</span></label><label><input type="radio" name="stage" value="作業中"><span>作業中</span></label><label><input type="radio" name="stage" value="公開前" checked><span>公開前</span></label></div></fieldset>
<div class="field-header"><label for="draft" id="draftLabel">いまの下書き</label><output for="draft" id="draftCount">0字</output></div><textarea id="draft" rows="8" required placeholder="点検したい原稿をここに貼り付けてください。"></textarea>
<div class="field-header"><label for="evidence">根拠・今回の指示 <span class="optional">任意</span></label></div><small id="evidenceHint">元の一文、手元の記録、変更しない箇所など（8,000字まで）。下書きだけでも点検できます。</small><textarea id="evidence" rows="3" aria-describedby="evidenceHint" placeholder="例：見出しは決定済み。末尾の案内だけを確認したい。"></textarea>
<p class="usage-note">点検は1分に12回、1日に100回まで。入力はこの画面を閉じると消えます。</p><div class="editor-bottom"><button type="submit" class="primary" id="runReview">この内容を点検する<span aria-hidden="true"> →</span></button><div class="secondary-actions"><button type="button" class="text-button" id="loadExample">架空例を入れる</button><button type="button" class="text-button" id="clearDraft">入力を消去</button></div></div><p class="feedback" id="reviewMsg" role="status"></p></form>
<section id="results" class="paper results" hidden aria-labelledby="result-title"><div class="resulthead"><div><p class="section-label">点検結果</p><h2 tabindex="-1" id="result-title">直す箇所と確認先</h2></div><button id="copyReview" type="button">結果をコピー</button></div><div id="resultList"></div><p class="feedback" id="resultMsg" role="status"></p></section></section>

<section id="owner" hidden aria-labelledby="owner-title"><div class="work-heading"><div><p class="section-label">販売者用</p><h1 id="owner-title" tabindex="-1">利用権の管理</h1></div><a href="/">点検室へ</a></div><div class="paper workpaper"><div class="resulthead"><h2>利用申請</h2><button id="refreshOwner" type="button">一覧を更新</button></div><p>note側の購入履歴またはメンバー資格を照合してから、該当するアカウントの利用権を設定してください。</p><div id="applications"></div><button id="moreOwner" type="button" hidden>次の申請を表示</button><p class="feedback" id="ownerMsg" role="status"></p></div></section>
</main><footer><span>無名S</span><span>note制作の検閲キット</span></footer></body></html>`;

export const css = `
:root{color-scheme:light;--sheet:#f8f6f1;--paper:#fffefa;--ink:#232d39;--sub:#52606a;--line:#d8d5c9;--teal:#13645f;--wash:#e9f0e9;--indigo:#283b50;--red:#8e352c;--serif:"Hiragino Mincho ProN","Yu Mincho",YuMincho,"Noto Serif CJK JP",serif;--sans:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;font:16px/1.65 var(--sans);background:var(--sheet);color:var(--ink)}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-height:100vh;display:flex;flex-direction:column}button,input,textarea,select{font:inherit;color:inherit}button,a{touch-action:manipulation}button{cursor:pointer;background:var(--paper);border:1px solid #9eaaa8;border-radius:5px;padding:.56rem 1rem;min-height:42px;line-height:1.45;font-weight:650}button:hover{background:var(--wash)}button:disabled{cursor:wait;opacity:.65}a,.underlink,.text-button{color:var(--teal);text-underline-offset:.23em}a:hover,.underlink:hover,.text-button:hover{text-decoration:underline}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,.stages input:focus-visible+span{outline:3px solid #17716e;outline-offset:3px}h1:focus,h2:focus,main:focus{outline:none}
.skip{position:absolute;left:8px;top:-90px;padding:.6rem 1rem;background:white;z-index:2}.skip:focus{top:4px}.mast{border-top:4px solid var(--indigo);border-bottom:1px solid var(--line);background:var(--paper)}.mast-inner,main,footer{width:min(calc(100% - 64px),1080px);margin-inline:auto}.mast-inner{min-height:63px;display:flex;align-items:center;justify-content:space-between;gap:1rem}.brand{display:flex;align-items:center;gap:11px;font-weight:780;font-size:1rem;letter-spacing:.045em}.mark{width:29px;height:29px;border-radius:4px;background:var(--indigo);position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none}.mark i{width:14px;height:17px;transform:rotate(-6deg);border:1.5px solid #fcf7eb;border-radius:1px;position:relative}.mark i:after,.mark i:before{content:"";position:absolute;height:1px;background:#fcf7eb;left:2px;top:5px;width:7px}.mark i:after{top:9px;width:5px}nav{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;justify-content:flex-end}nav a,.underlink{font-size:.83rem}.viewer{font-size:.8rem;color:var(--sub);overflow-wrap:anywhere}.underlink,.text-button{border:0;background:transparent;padding:.4rem .12rem}.underlink:hover,.text-button:hover{background:transparent}main{flex:1;margin-block:clamp(35px,6vw,78px) clamp(52px,8vw,110px)}footer{display:flex;justify-content:space-between;gap:1rem;padding:18px 0 25px;border-top:1px solid var(--line);color:var(--sub);font-size:.76rem}
h1,h2,h3,p,ol,ul{margin:0}h1,h2{font-family:var(--serif);font-weight:650;letter-spacing:.035em;line-height:1.4}h1{font-size:clamp(2.15rem,5vw,3.5rem)}h2{font-size:clamp(1.5rem,3vw,2.1rem)}h3{font-size:1rem}.fullstop{color:var(--teal)}.paper{background:var(--paper);border:1px solid var(--line);border-radius:9px;box-shadow:0 3px 12px #283b5008}.section-label,.byline{color:var(--teal);font-size:.8rem;letter-spacing:.11em;font-weight:750}.gate{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.96fr);gap:clamp(2rem,7vw,6rem);align-items:center;max-width:960px;margin:0 auto}.introduction{padding-left:clamp(0px,2vw,18px)}.introduction h1{margin:.7rem 0 1rem;font-size:clamp(3.9rem,7.6vw,6rem);line-height:1.22;letter-spacing:.04em}.lede{font-family:var(--serif);font-size:clamp(1rem,2vw,1.17rem);line-height:1.9}.mini-flow{margin-top:1.65rem;border-top:1px solid var(--line);padding-top:1rem;max-width:355px}.mini-flow h2{font:700 .82rem var(--sans);letter-spacing:.03em}.mini-flow ol{padding-left:1.5rem;margin-top:.5rem;color:var(--sub);font-size:.85rem;line-height:1.9}.mini-flow li::marker{color:var(--teal)}
.gate-form,.center,.workpaper,.results{padding:clamp(22px,4vw,44px)}.gate-form{border-top:3px solid var(--indigo)}.gate-form h2{margin:.3rem 0 .6rem}.gate-form>p:not(.section-label),.center>p:not(.section-label),.workpaper>p{color:var(--sub);font-size:.96rem}.gate-form form{margin-top:1.1rem}.gate-form label,.field-title,.field-header label,legend{font-weight:700;display:block}.gate-form label{margin-top:1rem}.gate-form input,.center input,.owner-form input,.owner-form select,input[type="datetime-local"],textarea{width:100%;min-width:0;border:1px solid #a4aca7;border-radius:5px;background:#fff;color:var(--ink);padding:.66rem .8rem}.gate-form input{margin-top:.3rem}.gate-form small,.center small,.workpaper small{display:block;color:var(--sub);font-size:.8rem;line-height:1.65}small{margin:.3rem 0}input::placeholder,textarea::placeholder{color:#63716f}.primary{background:var(--indigo);color:#fff;border-color:var(--indigo);padding:.72rem 1.1rem}.primary:hover{background:#384f66}.primary span{margin-left:.35rem}.wide{width:100%;margin-top:1.4rem}.feedback:empty{display:none}.feedback{font-size:.9rem;margin-top:.85rem;color:var(--teal);overflow-wrap:anywhere}.feedback.error{color:var(--red)}.center{max-width:645px;margin:auto;border-top:3px solid var(--indigo)}.center>*+*{margin-top:1rem}.center h1{font-size:clamp(1.7rem,4vw,2.5rem);margin-top:.25rem}.center .field-title{font-size:.9rem}.copyline,.actions,.secondary-actions,.resulthead,.work-heading,.field-header,.editor-bottom{display:flex;align-items:center;gap:.75rem}.copyline{margin:.35rem 0}.copyline input{font-family:monospace}.copyline button{flex:none}.actions,.secondary-actions{flex-wrap:wrap}.account-note,.optional{font-size:.8rem;color:var(--sub);font-weight:500}.work-heading,.resulthead,.field-header,.editor-bottom{justify-content:space-between}.work-heading{margin-bottom:1.6rem;align-items:flex-end}.work-heading .section-label,.resulthead .section-label{margin-bottom:.35rem}.work-heading a{flex:none;font-size:.87rem}#editor,#owner{max-width:930px;margin:auto}#editorCleanup{margin-bottom:1rem}.workpaper fieldset{border:0;padding:0;margin:0 0 1.4rem}.workpaper legend{padding:0;margin-bottom:.5rem}.stages{display:inline-flex;border:1px solid #9ca9a9;border-radius:6px;overflow:visible}.stages label{position:relative;cursor:pointer}.stages input{clip-path:inset(50%);position:absolute;width:1px;height:1px}.stages span{display:block;padding:.55rem 1.05rem;line-height:1.45;color:var(--sub);font-size:.9rem}.stages label+label{border-left:1px solid #a6b3b1}.stages label:first-child span{border-radius:4px 0 0 4px}.stages label:last-child span{border-radius:0 4px 4px 0}.stages input:checked+span{background:var(--indigo);color:white;font-weight:700}.field-header{margin:.8rem 0 .3rem}.field-header output{font-size:.78rem;color:var(--sub);font-variant-numeric:tabular-nums}.field-header .optional{margin-left:.35rem}textarea{display:block;resize:vertical;line-height:1.75}#draft{min-height:10rem}#evidence{min-height:5.6rem}#evidenceHint{margin:0 0 .4rem}.editor-bottom{margin-top:1.4rem;flex-wrap:wrap}.secondary-actions{gap:1rem}.text-button{font-size:.85rem}.results{margin-top:1.5rem;border-top:3px solid var(--teal)}.resulthead{align-items:center;flex-wrap:wrap}.resulthead button{font-size:.85rem}.result-group{border-top:1px solid var(--line);margin-top:1.35rem;padding-top:1rem}.result-group h3{color:var(--indigo);margin-bottom:.45rem}.result-group ul{padding-left:1.3rem}.result-group li+li{margin-top:.4rem}.issue{border-left:3px solid #9d7754;padding-left:.9rem;margin:.8rem 0}.issue p,.manual-item{white-space:pre-wrap;overflow-wrap:anywhere}.issue strong{font-size:.83rem;color:var(--sub);margin-right:.5rem}.issue p+p{margin-top:.2rem}.manual-item{margin:.5rem 0}.manual-item b{display:block}.muted{color:var(--sub);font-size:.9rem}
#owner .workpaper>p{margin:.7rem 0 1.2rem}.request{border-top:1px solid var(--line);padding:1.15rem 0}.request summary{cursor:pointer;min-height:42px;font-weight:700;overflow-wrap:anywhere}.request .state{font-weight:500;color:var(--sub);font-size:.85rem;margin-left:.6rem}.request .muted{margin:.3rem 0 .8rem}.owner-form{display:flex;gap:.7rem;flex-wrap:wrap;align-items:flex-end}.owner-form label{font-size:.86rem;font-weight:650;display:block}.owner-form label>*{display:block;font-weight:400;margin-top:.2rem}.owner-form select,.owner-form input{min-height:43px}.owner-form button{font-size:.9rem}
@media(max-width:720px){.mast-inner,main,footer{width:calc(100% - 32px)}.mast-inner{min-height:55px;flex-wrap:wrap;gap:.1rem .7rem;padding:8px 0}.brand{font-size:.89rem;gap:7px}.mark{width:25px;height:25px}nav{gap:.55rem;margin-left:auto}.viewer{display:none}nav a,.underlink{font-size:.76rem}.gate{grid-template-columns:1fr;gap:1.2rem;max-width:520px}.introduction{padding:0}.introduction h1{font-size:clamp(2.5rem,10vw,3.8rem);margin:.35rem 0}.introduction h1 br{display:none}.lede br{display:none}.mini-flow{margin-top:.85rem;padding-top:.65rem;max-width:none}.mini-flow ol{margin-top:.25rem}.gate-form{padding:1.4rem}.work-heading{align-items:flex-start;gap:.5rem;flex-wrap:wrap}.work-heading .account-note{align-self:flex-end}.center,.workpaper,.results{padding:1.2rem}.field-header label,legend{font-size:.95rem}.editor-bottom{align-items:flex-start;flex-direction:column;gap:.4rem}.editor-bottom>.primary{width:100%}.resulthead h2{font-size:1.4rem}.stages{width:100%}.stages label{flex:1;text-align:center}.stages span{padding:.6rem .2rem}.owner-form{display:grid;grid-template-columns:1fr}.actions{align-items:stretch}.copyline{gap:.4rem}.copyline input{font-size:.89rem;padding:.65rem .35rem}}
.usage-note{margin-top:.85rem;font-size:.8rem;color:var(--sub)}.clipboard-fallback{position:fixed;inset:0 auto auto -100vw;width:1px;height:1px}.receipt{margin-top:1rem;border-top:1px solid var(--line);padding-top:.7rem;font-size:.78rem;color:var(--sub);overflow-wrap:anywhere}#manualCopy{margin-top:.7rem}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

function client() {
  'use strict';
  const $ = id => document.getElementById(id);
  const screens = ['loading', 'entry', 'proof', 'waiting', 'editor', 'owner'];
  const ownerRoute = location.pathname.replace(/\/$/, '') === '/owner';
  const stages = [...document.querySelectorAll('input[name="stage"]')];
  const rejectText = '通信できませんでした。接続を確認して、もう一度お試しください。';
  let viewer = null, screen, lastResult = '', cursor = null, verifiedHere = false, revision = 0, generation = 0;
  let ownerLoading = false;
  $('draft').maxLength = 24000;
  $('evidence').maxLength = 8000;
  const updateFieldGuide = () => {
    const before = stages[0].checked;
    $('draftLabel').textContent = before ? '着手前のメモ' : 'いまの下書き';
    $('draft').placeholder = before ? '今回書くもの、読んでほしい人、決まっていることを書いてください。' : '点検したい原稿をここに貼り付けてください。';
    $('draftCount').textContent = $('draft').value.length.toLocaleString('ja-JP') + ' / 24,000字';
  };
  const message = (id, value = '', error = false) => {
    const node = $(id);
    node.textContent = value;
    node.classList.toggle('error', error);
  };
  function show(id, focus = true) {
    screens.forEach(name => { $(name).hidden = id !== name; });
    if (focus && screen !== id) ($(id).querySelector('h1') || $('main')).focus();
    screen = id;
  }
  function make(tag, content, className) {
    const el = document.createElement(tag);
    if (content != null) el.textContent = content;
    if (className) el.className = className;
    return el;
  }
  async function api(path, payload) {
    let response;
    try {
      const options = {credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'}};
      if (payload !== undefined) {
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }
      response = await fetch(path, options);
    } catch { throw new Error(rejectText); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('ツールから応答を読み取れません。時間をおいてお試しください。'); }
    if (!response.ok) {
      const err = new Error(typeof data?.error === 'string' ? data.error : rejectText);
      err.status = response.status;
      throw err;
    }
    return data;
  }
  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(value); return true; } catch { /* Fallback for restricted browsers. */ }
    }
    const field = make('textarea');
    field.className = 'clipboard-fallback';
    field.readOnly = true;
    field.value = value;
    const previous = document.activeElement;
    document.body.append(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* Manual copy stays available. */ }
    field.remove();
    if (previous instanceof HTMLElement) previous.focus({preventScroll:true});
    return ok;
  }
  const fmt = value => {
    const time = new Date(value);
    return Number.isFinite(time.getTime()) ? new Intl.DateTimeFormat('ja-JP', {dateStyle:'short', timeStyle:'short'}).format(time) : '日時不明';
  };
  function clearResults() {
    lastResult = '';
    $('resultList').replaceChildren();
    $('manualCopy')?.remove();
    $('results').hidden = true;
    message('resultMsg');
  }
  function edited() {
    revision++;
    clearResults();
    message('reviewMsg');
    updateFieldGuide();
  }
  function clearInputs() {
    $('reviewForm').reset();
    edited();
  }
  function updateOwnerField() {
    const enabled = ownerRoute || $('noteId').value.trim().replace(/^@/, '').toLowerCase() === 'ss_yr';
    $('ownerField').hidden = !enabled;
    $('ownerKey').required = enabled;
    if (!enabled) $('ownerKey').value = '';
  }
  async function setSession(next, focus = true) {
    if (viewer && (!next || viewer.noteId !== next.noteId || (viewer.active && !next.active))) {
      clearInputs();
      $('applications').replaceChildren();
      cursor = null;
      verifiedHere = false;
      generation++;
    }
    viewer = next || null;
    $('identity').textContent = viewer ? '@' + viewer.noteId : '';
    $('identity').hidden = !viewer;
    $('logout').hidden = !viewer;
    $('ownerLink').hidden = !viewer?.owner || ownerRoute;
    if (!viewer) {
      updateOwnerField();
      show('entry', focus);
    } else if (ownerRoute && viewer.owner) {
      show('owner', focus);
      await ownerList(false);
    } else if (ownerRoute || !viewer.active) {
      let title = '購入状況を照合中';
      let description = '本人確認が済みました。販売者がnoteで購入またはメンバー資格を確認すると、この画面から点検室に入れます。';
      if (ownerRoute) {
        title = '販売者用の画面です';
        description = 'このアカウントの点検室は、下のリンクから開けます。';
      } else if (viewer.state === 'expired') {
        title = 'メンバー利用期間が終了しました';
        description = '現在の資格や購入について販売者に確認してください。利用権が更新されたら、ここから再開できます。';
      } else if (viewer.state === 'revoked') {
        title = '利用権が停止されています';
        description = '購入状況について、販売者にお問い合わせください。';
      }
      $('waiting-title').textContent = title;
      $('waitingText').textContent = '@' + viewer.noteId + '　' + description;
      $('waitingHome')?.remove();
      $('refresh').hidden = ownerRoute;
      if (ownerRoute) {
        const a = make('a', '点検室へ戻る');
        a.id = 'waitingHome';
        a.href = '/';
        $('waitingText').append(' ', a);
      }
      $('cleanup').hidden = !verifiedHere;
      show('waiting', focus);
    } else {
      $('editorCleanup').hidden = !verifiedHere;
      const label = viewer.kind === 'membership' ? fmt(viewer.expiresAt) + ' まで利用可' : viewer.owner ? '販売者' : '単品購入';
      $('entitlement').textContent = '@' + viewer.noteId + '　' + label;
      show('editor', focus);
    }
  }
  async function loadSession() {
    const response = await api('/api/session');
    await setSession(response.viewer, !!screen);
  }
  async function startPage() {
    try { await loadSession(); }
    catch (err) {
      $('loadingText').textContent = err.message;
      $('retryLoad').hidden = false;
      show('loading');
    }
  }
  async function locked(button, statusId, job) {
    if (button.disabled) return;
    button.disabled = true;
    message(statusId);
    try { await job(); }
    catch (err) { message(statusId, err.message || rejectText, true); }
    finally { button.disabled = false; }
  }
  function renderResult(data) {
    const report = data.review || data;
    if (![report.fixes,report.manual,report.checked].every(Array.isArray)) throw new Error('点検結果の形式を確認できません。もう一度お試しください。');
    clearResults();
    const lines = ['【原稿の点検結果】' + stages.find(item => item.checked).value];
    const container = $('resultList');
    function group(title, empty, items, draw) {
      const section = make('section', null, 'result-group');
      section.append(make('h3', title + '（' + items.length + '）'));
      lines.push('', '■ ' + title);
      if (items.length) {
        for (const item of items) draw(item, section);
      } else {
        section.append(make('p', empty, 'muted'));
        lines.push(empty);
      }
      container.append(section);
    }
    group('直す候補', '入力した範囲では、修正候補は挙がりませんでした。', report.fixes, (fix, section) => {
      const issue = make('div', null, 'issue');
      for (const [name,value] of [['該当箇所の目印',fix.excerpt],['修正案',fix.suggestion],['理由',fix.reason]]) {
        const p = make('p');
        p.append(make('strong', name), String(value));
        issue.append(p);
        lines.push(name + '：' + value);
      }
      section.append(issue);
    });
    group('人が確かめること', '追加の確認項目は挙がりませんでした。', report.manual, (item, section) => {
      const p = make('p', null, 'manual-item');
      p.append(make('b', item.label), String(item.action));
      section.append(p);
      lines.push('・' + item.label + '：' + item.action);
    });
    group('ツールが確認した範囲', '確認した範囲の記録はありません。', report.checked, (item, section) => {
      let list = section.querySelector('ul');
      if (!list) { list = make('ul'); section.append(list); }
      list.append(make('li', item));
      lines.push('・' + item);
    });
    if (typeof data.receipt === 'string' && data.receipt) {
      const receipt = '点検番号　' + data.receipt;
      container.append(make('p', receipt, 'receipt'));
      lines.push('', receipt);
    }
    lastResult = lines.join('\n');
    $('results').hidden = false;
    $('result-title').focus();
  }
  const stateLabel = item => {
    if (item.state === 'pending') return '承認待ち';
    if (item.state === 'revoked') return '停止中';
    if (item.state === 'expired') return 'メンバー期限切れ';
    return item.kind === 'purchase' ? '単品購入' : 'メンバー利用中';
  };
  function application(item) {
    const detail = make('details', null, 'request');
    const summary = make('summary', '@' + item.noteId);
    summary.append(make('span', stateLabel(item), 'state'));
    detail.append(summary);
    let dates = '申請日時　' + fmt(item.requestedAt);
    if (item.expiresAt) dates += '　／　利用終了　' + fmt(item.expiresAt);
    detail.append(make('p', dates, 'muted'));
    const form = make('form', null, 'owner-form');
    const actionLabel = make('label', '変更する利用権');
    const action = make('select');
    for (const [value,label] of [['','選んでください'],['purchase','単品購入（買い切り）'],['membership','メンバー利用（期限付き）'],['revoke','利用を停止']]) {
      if (item.kind === 'purchase' && value === 'membership') continue;
      const option = make('option', label);
      option.value = value;
      action.append(option);
    }
    action.required = true;
    actionLabel.append(action);
    const expiryLabel = make('label', '終了日時（端末の現地時刻）');
    const expiry = make('input');
    expiry.type = 'datetime-local';
    expiryLabel.append(expiry);
    expiryLabel.hidden = true;
    action.addEventListener('change', () => {
      expiry.required = action.value === 'membership';
      expiryLabel.hidden = !expiry.required;
    });
    const submit = make('button', '変更を適用', 'primary');
    submit.type = 'submit';
    const status = make('p', '', 'feedback');
    status.setAttribute('role','status');
    form.append(actionLabel,expiryLabel,submit);
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (submit.disabled) return;
      const value = action.value;
      let expiryValue = null;
      if (value === 'membership') {
        const date = new Date(expiry.value);
        if (!Number.isFinite(date.getTime()) || date <= new Date()) {
          status.textContent = '現在より後の終了日時を指定してください。';
          status.classList.add('error');
          expiry.focus();
          return;
        }
        expiryValue = date.toISOString();
      }
      const question = value === 'revoke' ? ' の利用を停止し、現在のログインを解除しますか？' : ' の利用権を「' + action.selectedOptions[0].textContent + '」に変更しますか？';
      if (!window.confirm('@' + item.noteId + question)) return;
      submit.disabled = true;
      status.classList.remove('error');
      status.textContent = '適用しています…';
      try {
        await api('/api/admin/access', {subject:item.subject,action:value,...(expiryValue ? {expiresAt:expiryValue} : {})});
        status.textContent = '利用権を変更しました。';
        const updated = await ownerList(false);
        if (updated && screen === 'owner') message('ownerMsg', '@' + item.noteId + ' の利用権を変更しました。');
      } catch (err) {
        status.classList.add('error');
        status.textContent = err.message;
      } finally { submit.disabled = false; }
    });
    detail.append(form,status);
    return detail;
  }
  async function ownerList(more) {
    if (ownerLoading) return false;
    ownerLoading = true;
    $('refreshOwner').disabled = $('moreOwner').disabled = true;
    const seq = generation;
    try {
      const url = '/api/admin/access' + (more && cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
      const data = await api(url);
      if (seq !== generation || screen !== 'owner') return false;
      if (!more) $('applications').replaceChildren();
      for (const item of data.entries) $('applications').append(application(item));
      if (!$('applications').childElementCount) $('applications').append(make('p', '現在、利用申請はありません。','muted'));
      cursor = data.nextCursor;
      $('moreOwner').hidden = !cursor;
      message('ownerMsg');
      return true;
    } catch (err) {
      message('ownerMsg', err.message, true);
      return false;
    } finally {
      ownerLoading = false;
      $('refreshOwner').disabled = $('moreOwner').disabled = false;
    }
  }
  $('noteId').addEventListener('input', updateOwnerField);
  if (ownerRoute) {
    $('loginTitle').textContent = '販売者として開く';
    $('noteId').value = 'ss_yr';
    $('noteId').readOnly = true;
  }
  $('entryForm').addEventListener('submit', ev => {
    ev.preventDefault();
    locked($('entryForm').querySelector('button'), 'entryMsg', async () => {
      const data = await api('/api/auth/start', {noteId:$('noteId').value,passcode:$('passcode').value,...($('ownerField').hidden ? {} : {ownerKey:$('ownerKey').value})});
      $('passcode').value = $('ownerKey').value = '';
      $('proofUser').textContent = '@' + data.noteId;
      $('proofCode').value = data.code;
      $('proofExpiry').textContent = '有効期限　' + fmt(data.expiresAt) + '（端末の現地時刻）';
      $('noteProfile').href = 'https://note.com/' + encodeURIComponent(data.noteId);
      message('proofMsg');
      show('proof');
    });
  });
  const copyCode = document.querySelector('[data-copy-code]');
  copyCode.addEventListener('click', () => locked(copyCode, 'proofMsg', async () => {
    if (await copyText($('proofCode').value)) message('proofMsg','確認コードをコピーしました。');
    else { $('proofCode').select(); message('proofMsg','選択した確認コードを手動でコピーしてください。'); }
  }));
  $('restart').addEventListener('click', () => { $('proofCode').value = ''; message('entryMsg'); show('entry'); });
  $('confirm').addEventListener('click', () => locked($('confirm'), 'proofMsg', async () => {
    const data = await api('/api/auth/confirm',{});
    verifiedHere = true;
    $('proofCode').value = '';
    await setSession(data.viewer);
  }));
  $('refresh').addEventListener('click', () => locked($('refresh'), 'waitingMsg', async () => {
    await loadSession();
    if (screen === 'waiting') message('waitingMsg','現在の利用状況を表示しています。');
  }));
  $('logout').addEventListener('click', () => {
    if (($('draft').value || $('evidence').value) && !window.confirm('ログアウトすると、この画面の下書きと点検結果は消えます。続けますか？')) return;
    const id = screen === 'owner' ? 'ownerMsg' : screen === 'editor' ? 'reviewMsg' : 'waitingMsg';
    locked($('logout'), id, async () => {
      await api('/api/auth/logout',{});
      await setSession(null);
      if (!ownerRoute) $('noteId').value = '';
      updateOwnerField();
      message('entryMsg','ログアウトしました。');
    });
  });
  $('retryLoad').addEventListener('click', startPage);
  for (const stage of stages) stage.addEventListener('change', edited);
  $('draft').addEventListener('input', edited);
  $('evidence').addEventListener('input', edited);
  $('reviewForm').addEventListener('submit', ev => {
    ev.preventDefault();
    locked($('runReview'), 'reviewMsg', async () => {
      if (!$('draft').value.trim()) {
        $('draft').focus();
        throw new Error('点検する文章を入力してください。');
      }
      const seq = revision;
      message('reviewMsg','点検しています…');
      try {
        const data = await api('/api/review',{draft:$('draft').value,evidence:$('evidence').value,stage:stages.find(item => item.checked).value});
        if (screen !== 'editor') return;
        if (revision !== seq) {
          message('reviewMsg','入力が変わりました。現在の内容でもう一度点検してください。');
          return;
        }
        message('reviewMsg');
        renderResult(data);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          await loadSession();
          if (screen === 'entry') message('entryMsg', '利用状況を再確認するため、もう一度本人確認を行ってください。');
        }
        throw err;
      }
    });
  });
  $('loadExample').addEventListener('click', () => locked($('loadExample'), 'reviewMsg', async () => {
    if (($('draft').value || $('evidence').value) && !window.confirm('いまの入力を架空例に置き換えますか？')) return;
    const seq = revision;
    const demo = await api('/api/example');
    if (screen !== 'editor' || seq !== revision) return;
    $('draft').value = demo.draft;
    $('evidence').value = demo.evidence;
    const stage = stages.find(item => item.value === demo.stage);
    if (stage) stage.checked = true;
    edited();
    message('reviewMsg','架空例を入れました。「この内容を点検する」を押してください。');
  }));
  $('clearDraft').addEventListener('click', () => {
    if (($('draft').value || $('evidence').value) && !window.confirm('この画面の入力と点検結果を消去しますか？')) return;
    clearInputs();
    message('reviewMsg','入力と点検結果を消去しました。');
    $('draft').focus();
  });
  $('copyReview').addEventListener('click', () => locked($('copyReview'), 'resultMsg', async () => {
    if (await copyText(lastResult)) { message('resultMsg','点検結果をコピーしました。'); return; }
    $('manualCopy')?.remove();
    const field = make('textarea');
    field.id = 'manualCopy';
    field.readOnly = true;
    field.value = lastResult;
    field.setAttribute('aria-label', '手動コピー用の点検結果');
    $('results').append(field);
    field.focus();
    field.select();
    message('resultMsg','選択した点検結果を手動でコピーしてください。');
  }));
  $('refreshOwner').addEventListener('click', () => ownerList(false));
  $('moreOwner').addEventListener('click', () => ownerList(true));
  addEventListener('pageshow', ev => { if (ev.persisted) startPage(); });
  updateFieldGuide();
  startPage();
}

export const js = '(' + client.toString() + ')();';
