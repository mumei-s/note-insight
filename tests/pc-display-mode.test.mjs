import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { sceneFixture, pause } from './react-scene-fixture.mjs';

test('TOPのPC/スマホ切替を保存し、同じデータ画面・入力・ログインを保持する', async t => {
  const h=await sceneFixture(t);
  let wide=true;
  h.w.matchMedia=()=>({matches:wide});
  h.w.localStorage.setItem('mumei-insight-access-token','fixture-session');
  const {DisplayModeSwitch,useInsightDisplayMode,readDisplayMode}=h.load('src/insight-display-mode.tsx');
  let mounts=0;
  function SavedView(){React.useEffect(()=>{mounts++},[]);return React.createElement('input',{defaultValue:'保存済み表示'})}
  function Shell({top=true}){useInsightDisplayMode();return React.createElement(React.Fragment,{},top&&React.createElement(DisplayModeSwitch),React.createElement(SavedView))}
  await h.render(Shell,{});
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'pc');
  const input=h.w.document.querySelector('input');input.value='書きかけの検索';
  await h.click([...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='スマホ版'));
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'mobile');
  assert.equal(readDisplayMode(),'mobile');
  assert.equal(h.w.localStorage.getItem('mumei-insight-display-mode-v1'),'mobile');
  await h.render(Shell,{top:false});
  assert.equal(h.w.document.querySelector('input'),input);
  assert.equal(input.value,'書きかけの検索');
  assert.equal(mounts,1);
  assert.equal(h.w.localStorage.getItem('mumei-insight-access-token'),'fixture-session');
  await h.render(Shell,{});
  await h.click([...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='タブレット版'));
  assert.equal(readDisplayMode(),'tablet');
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'tablet');
  assert.equal(h.w.localStorage.getItem('mumei-insight-display-mode-v1'),'tablet');
  assert.equal(h.w.document.querySelector('input'),input);
  assert.equal(input.value,'書きかけの検索');
  await h.click([...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='PC版'));
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'pc');
  wide=false;
  await React.act(async()=>{h.w.dispatchEvent(new h.w.Event('resize'));await pause()});
  assert.equal(readDisplayMode(),'pc','選択後は画面幅が変わっても勝手に切り替えない');
  assert.equal(mounts,1);
});

test('未選択ではスマホ・タブレット縦横・PCの画面幅に合う表示を選ぶ',async t=>{
  const h=await sceneFixture(t);let width=390;
  h.w.matchMedia=query=>({matches:width>=Number(query.match(/min-width:\s*(\d+)/)[1])});
  const {DisplayModeSwitch}=h.load('src/insight-display-mode.tsx');await h.render(DisplayModeSwitch,{});
  for(const [next,expected] of [[390,'mobile'],[599,'mobile'],[600,'tablet'],[768,'tablet'],[820,'tablet'],[1024,'tablet'],[1199,'tablet'],[1200,'pc'],[1440,'pc']]){
    width=next;await React.act(async()=>{h.w.dispatchEvent(new h.w.Event('resize'));await pause()});
    assert.equal(h.w.document.documentElement.dataset.insightLayout,expected,`幅${next}`);
  }
  assert.equal(h.w.document.querySelectorAll('button').length,3);
  await h.click([...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='タブレット版'));
  width=390;await React.act(async()=>{h.w.dispatchEvent(new h.w.Event('resize'));await pause()});
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'tablet','ユーザーの選択を優先');
});

test('未選択は画面幅に追従し、別タブで保存した切替も反映する',async t=>{
  const h=await sceneFixture(t);let wide=false;h.w.matchMedia=()=>({matches:wide});
  const {DisplayModeSwitch}=h.load('src/insight-display-mode.tsx');await h.render(DisplayModeSwitch,{});
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'mobile');
  wide=true;await React.act(async()=>{h.w.dispatchEvent(new h.w.Event('resize'));await pause()});
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'pc');
  h.w.localStorage.setItem('mumei-insight-display-mode-v1','mobile');
  await React.act(async()=>{h.w.dispatchEvent(new h.w.StorageEvent('storage',{key:'mumei-insight-display-mode-v1'}));await pause()});
  assert.equal(h.w.document.documentElement.dataset.insightLayout,'mobile');
  assert.equal([...h.w.document.querySelectorAll('button')].find(b=>b.textContent==='スマホ版').getAttribute('aria-pressed'),'true');
});

test('常時演出は表示中だけ継続し、画面外・背景タブ・動き軽減では止める',async t=>{
  let visible,mediaChange;
  class Observer{constructor(callback){visible=callback}observe(){}disconnect(){}}
  const h=await sceneFixture(t,{globals:{IntersectionObserver:Observer}});
  const media={matches:false,addEventListener(_name,fn){mediaChange=fn},removeEventListener(){}};
  h.w.matchMedia=()=>media;
  const {useVisibleMotion}=h.load('src/insight-visible-motion.ts');
  function Hero(){const state=useVisibleMotion();return React.createElement('section',{ref:state.ref,'data-motion':state.motion?'on':'off'},'INSIGHT')}
  await h.render(Hero,{});const node=h.w.document.querySelector('section');
  await React.act(async()=>{visible([{isIntersecting:true}]);await pause()});assert.equal(node.dataset.motion,'on');
  await React.act(async()=>{visible([{isIntersecting:false}]);await pause()});assert.equal(node.dataset.motion,'off');
  await React.act(async()=>{visible([{isIntersecting:true}]);await pause()});assert.equal(node.dataset.motion,'on');
  Object.defineProperty(h.w.document,'visibilityState',{value:'hidden',configurable:true});
  await React.act(async()=>{h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));await pause()});assert.equal(node.dataset.motion,'off');
  Object.defineProperty(h.w.document,'visibilityState',{value:'visible',configurable:true});
  await React.act(async()=>{h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));await pause()});assert.equal(node.dataset.motion,'on');
  media.matches=true;await React.act(async()=>{mediaChange();await pause()});assert.equal(node.dataset.motion,'off');
  assert.equal(h.w.document.querySelector('section'),node);
});
