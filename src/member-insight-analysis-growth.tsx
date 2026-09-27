import { useState } from 'react';
import './member-insight-analysis-growth.css';

type Daily = { date: string; pageViews?: number | null };
const DAY = 86400000;
const n = (v: number) => new Intl.NumberFormat('ja-JP').format(Math.round(v));
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v))}`;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const change = (now: number, before: number) => before > 0 ? `${signed((now - before) / before * 100)}%` : now === 0 ? '0%' : '前週0のため率なし';
const dayAt = (time: number) => new Date(time).toISOString().slice(0, 10);

export function growthPerspective(rows: Daily[], today: string) {
  // Compare matching weekdays and omit today's unfinished official total.
  const byDay = new Map(rows.filter(r => r.date < today && /^\d{4}-\d{2}-\d{2}$/.test(r.date)).map(r => [r.date, r.pageViews == null || (!Number.isFinite(Number(r.pageViews)) || Number(r.pageViews) < 0) ? null : Number(r.pageViews)]));
  const end = [...byDay.keys()].sort().at(-1);
  if (!end) return null;
  const last = Date.parse(end + 'T00:00:00Z');
  const pairs = Array.from({ length: 7 }, (_, i) => {
    const date = dayAt(last - (6 - i) * DAY), previousDate = dayAt(last - (13 - i) * DAY);
    const current = byDay.get(date) ?? null, previous = byDay.get(previousDate) ?? null;
    return { date, previousDate, current, previous, delta: current != null && previous != null ? current - previous : null };
  });
  const known = pairs.reduce((s, r) => s + Number(r.current != null) + Number(r.previous != null), 0);
  const base = { pairs, known, start: pairs[0].date, end, previousStart: pairs[0].previousDate, previousEnd: pairs[6].previousDate };
  if (known !== 14) return { ...base, complete: false as const };
  const current = pairs.reduce((s, r) => s + r.current!, 0), previous = pairs.reduce((s, r) => s + r.previous!, 0);
  const currentMedian = median(pairs.map(r => r.current!)), previousMedian = median(pairs.map(r => r.previous!));
  const improved = pairs.filter(r => r.delta! > 0).length, declined = pairs.filter(r => r.delta! < 0).length;
  const gains = pairs.reduce((s, r) => s + Math.max(0, r.delta!), 0), top = [...pairs].sort((a, b) => b.delta! - a.delta!)[0];
  const topShare = gains ? Math.max(0, top.delta!) / gains * 100 : 0;
  let title = '合計は横ばい。日ごとの動きを確認', detail = `前週と合計は同じです。増加した日は${improved}日、減少した日は${declined}日あります。`;
  if (current > previous) {
    if (topShare >= 60) {
      title = '増加は一部の日に集中';
      detail = `${top.date}の前週同曜日との差は${signed(top.delta!)} PV。増加した日の増分合計の${n(topShare)}%がこの1日です。7日中${improved}日が増加しており、継続的な底上げかはまだ分けて見る必要があります。`;
    } else if (currentMedian > previousMedian && improved >= 4) {
      title = '合計だけでなく、日々のPVも底上げ';
      detail = `7日中${improved}日で前週の同じ曜日を上回り、日別中央値も${n(previousMedian)}から${n(currentMedian)} PVへ増えています。特定の1日だけではない広がりが見られます。`;
    } else {
      title = '合計は増加。日ごとの動きはばらつき';
      detail = `増加は${improved}/7日、日別中央値は${n(previousMedian)} → ${n(currentMedian)} PVです。合計の伸びと普段の水準を分けて確認できます。`;
    }
  } else if (current < previous) {
    title = declined >= 4 ? '複数の日でPVが減少' : '合計減少は一部の日に集中';
    detail = `7日中${declined}日が前週同曜日を下回り、日別中央値は${n(previousMedian)} → ${n(currentMedian)} PVです。下の棒で減少した日と差を確認できます。`;
  }
  return { ...base, complete: true as const, current, previous, currentMedian, previousMedian, improved, declined, topShare, title, detail };
}

export function GrowthAnalysis({ rows, today }: { rows: Daily[]; today: string }) {
  const result = growthPerspective(rows, today), [selected, setSelected] = useState(6);
  if (!result) return <p className="mipro-note">今日より前の日別PVがまだありません。前週との比較には14日分が必要です。当日の途中値は比較から除きます。</p>;
  const focus = result.pairs[selected], max = Math.max(1, ...result.pairs.flatMap(r => [r.current ?? 0, r.previous ?? 0]));
  const value = (v: number | null) => v == null ? '未取得' : n(v) + ' PV';
  return <section className="mipro-growth" aria-label="PVの伸びの内訳">
    <p className="mipro-growth-period">今回 {result.start}〜{result.end}<br/>前週 {result.previousStart}〜{result.previousEnd} · 同じ曜日で比較</p>
    {result.complete ? <>
      <div className="mipro-growth-verdict"><small>保存値から読み取れること</small><h3>{result.title}</h3><p>{result.detail}</p></div>
      <div className="mipro-growth-kpis">
        <span><small>7日合計の前週比</small><b>{change(result.current, result.previous)}</b><em>{n(result.previous)} → {n(result.current)} PV</em></span>
        <span><small>日別中央値の前週比</small><b>{change(result.currentMedian, result.previousMedian)}</b><em>{n(result.previousMedian)} → {n(result.currentMedian)} PV</em></span>
        <span><small>前週同曜日より増加</small><b>{result.improved} / 7日</b><em>合計と増加日の広がりを分けて評価</em></span>
      </div>
    </> : <p className="mipro-warning">比較に必要な14日中{result.known}日分を取得、{14 - result.known}日分が未取得です。増減の結論はまだ出しません。</p>}
    <figure className="mipro-growth-chart">
      <figcaption><b>どの日に差が出たか</b><span><i className="current"/>今回 <i className="previous"/>前週</span><small>棒の長さ＝PV（共通目盛り 0〜{n(max)}）／右端＝前週との差</small></figcaption>
      <div className="mipro-growth-bars">{result.pairs.map((r, i) => <button key={r.date} className={selected === i ? 'selected' : ''} aria-pressed={selected === i} onClick={() => setSelected(i)} aria-label={`${r.date} ${value(r.current)}、前週同曜日 ${r.previousDate} ${value(r.previous)}`}>
        <span className="date">{r.date.slice(5).replace('-', '/')}</span>
        <span className="tracks" aria-hidden="true"><i className={r.current == null ? 'missing' : 'current'} style={{ width: r.current == null ? '100%' : `${r.current / max * 100}%` }}/><i className={r.previous == null ? 'missing' : 'previous'} style={{ width: r.previous == null ? '100%' : `${r.previous / max * 100}%` }}/></span>
        <strong className={r.delta == null ? '' : r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}>{r.delta == null ? '未取得' : signed(r.delta)}</strong>
      </button>)}</div>
      <div className="mipro-growth-readout" aria-live="polite"><b>{focus.date}：{value(focus.current)}</b><span>前週同曜日 {focus.previousDate}：{value(focus.previous)}</span><span>差：{focus.delta == null ? '未取得のため算出不可' : signed(focus.delta) + ' PV'}</span></div>
    </figure>
    <p className="mipro-growth-source">今日の途中値を除き、保存済みの最新日までを比較。中央値は7日を小さい順に並べた中央の値です。増減の原因や投稿・告知の効果を、この比較だけで断定するものではありません。「集中」は、増加した日の増分合計の60%以上が1日に偏る場合です。</p>
  </section>;
}
