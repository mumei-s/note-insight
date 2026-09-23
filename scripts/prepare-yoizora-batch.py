"""Read public note data; never signs in, writes drafts, or sends notifications."""
import concurrent.futures, datetime, hashlib, json, pathlib, sys, urllib.parse, urllib.request

OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
CACHE = OUT / 'api-cache'; CACHE.mkdir(exist_ok=True)
TAG = 'イケメングランプリ宵空カップ'
SOURCES = ['n3184e99d27bf', 'nc5786f97f59b']
FINAL = 'nb4f6934381e9'
NOW = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
DAYS = {NOW.date(), (NOW-datetime.timedelta(days=1)).date()}

def get(path):
    dest = CACHE / (hashlib.sha256(path.encode()).hexdigest()+'.json')
    if dest.exists(): return json.loads(dest.read_text())
    req = urllib.request.Request('https://note.com'+path, headers={'User-Agent':'Mozilla/5.0', 'Accept':'application/json'})
    with urllib.request.urlopen(req, timeout=45) as r: value = json.load(r)
    dest.write_text(json.dumps(value, ensure_ascii=False))
    return value['data'] if 'data' in value else value

def data(path):
    value=get(path)
    return value.get('data',value)

def notes(d): return d.get('contents',d.get('notes',[]))
def unwrap(n): return n.get('note',n)
def username(u): return str(u.get('urlname') or u.get('url_name') or '').lower()

def main():
    people={}; seen_pages=set(); tag_count=0
    for page in range(1,501):
        d=data('/api/v3/hashtags/'+urllib.parse.quote(TAG)+'/notes?order=new&page='+str(page)+'&paid_only=false')
        rows=[unwrap(n) for n in notes(d)]
        signature=tuple(n.get('key') for n in rows)
        if rows and signature in seen_pages: raise RuntimeError('Repeated hashtag page')
        seen_pages.add(signature)
        for n in rows:
            u=n.get('user') or n.get('author') or {}; who=username(u)
            if not who or who=='ss_yr': continue
            if who not in people:people[who]={'user':u,'tagKey':n['key'],'sourceTags':[TAG],'sourceKeys':[]}
        tag_count=len(people); print('hashtag',page,tag_count,flush=True)
        if not rows or d.get('is_last_page') or d.get('isLastPage'):break
    else:raise RuntimeError('Hashtag pagination incomplete')
    likes_counts={}
    for source in SOURCES:
        count=0; seen_pages=set()
        for page in range(1,501):
            d=data(f'/api/v3/notes/{source}/likes?page={page}&per=50'); rows=d.get('likes',[])
            signature=tuple(username(n.get('user',n)) for n in rows)
            if rows and signature in seen_pages: raise RuntimeError('Repeated likes page')
            seen_pages.add(signature)
            for n in rows:
                u=n.get('user',n);who=username(u);count+=1
                if not who or who=='ss_yr':continue
                c=people.setdefault(who,{'user':u,'sourceKeys':[],'sourceTags':[]})
                if source not in c['sourceKeys']:c['sourceKeys'].append(source)
            print('likes',source,page,count,'unique',len(people),flush=True)
            if len(rows)<50:break
        else:raise RuntimeError('Likes pagination incomplete')
        likes_counts[source]=count
    (OUT/'people.json').write_text(json.dumps(people,ensure_ascii=False,indent=2))
    def resolve(pair):
        who,c=pair
        if c.get('tagKey'):key=c['tagKey'];origin='hashtag'
        else:
            a=notes(data(f'/api/v2/creators/{who}/contents?kind=note&page=1&disabled_pinned=true&with_notes=false'))
            latest=unwrap(a[0]) if a else None
            chosen=None
            for x in a:
                n=unwrap(x);stamp=n.get('publishAt') or n.get('publish_at') or ''
                try:recent=datetime.datetime.fromisoformat(stamp).astimezone(NOW.tzinfo).date() in DAYS
                except ValueError:recent=False
                if recent:chosen=n;break
            origin='todayYesterday'
            if chosen is None:
                a=notes(data(f'/api/v2/creators/{who}/contents?kind=note&page=1&disabled_pinned=false&with_notes=false'))
                chosen=next((unwrap(n) for n in a if unwrap(n).get('isPinned') is True or unwrap(n).get('is_pinned') is True),None);origin='fixedFallback'
                if chosen is None:chosen=latest;origin='latestFallback'
            if chosen is None:return {'excluded':who,'reason':'公開記事なし'}
            key=chosen['key']
        n=data(f'/api/v3/notes/{key}');u=n.get('user') or n.get('author') or {};actual=username(u)
        name=str(u.get('nickname') or u.get('name') or '').strip()
        if actual!=who or n.get('key')!=key or not name:raise RuntimeError('Author mismatch or missing name: '+who+'/'+key)
        url=f'https://note.com/{who}/n/{key}'
        result = {'urlname':who,'likerKey':str(u.get('key') or u.get('id') or who),'creator':name,'caption':name+'さん',
          'actorUrl':f'https://note.com/{who}','actorImageUrl':u.get('user_profile_image_url') or u.get('user_profile_image_path') or u.get('userProfileImagePath') or u.get('profileImageUrl') or '',
          'url':url,'title':n.get('name') or n.get('title'),'latestKey':key,'thumbUrl':n.get('eyecatch_url') or n.get('eyecatch') or '',
          'publishAt':n.get('publish_at') or n.get('publishAt') or '', 'sourceKeys':c['sourceKeys'],'sourceTags':c['sourceTags'],
          'articleSource':origin,'creatorVerified':{'articleKey':key,'urlname':actual,'name':name,'checkedAt':NOW.isoformat()}}
        saved=OUT/'verified';saved.mkdir(exist_ok=True);(saved/(who+'.json')).write_text(json.dumps(result,ensure_ascii=False))
        return result
    pairs=[(who,c) for who,c in people.items() if who!='fuku444']
    pairs.append(('fuku444',{'tagKey':FINAL,'sourceTags':[],'sourceKeys':[]}))
    rows=[];excluded=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i,r in enumerate(ex.map(resolve,pairs),1):
            if 'excluded' in r:excluded.append(r)
            else:rows.append(r)
            print('verified',i,'/',len(pairs),flush=True)
    marker=rows.pop()
    rows.sort(key=lambda r: 2 if r['articleSource']=='latestFallback' else (0 if r['articleSource']=='hashtag' else 1))
    rows.append(marker)
    for i,r in enumerate(rows,1):r['index']=i
    rows[-1]['finalMarker']=True;rows[-1]['articleSource']='final'
    assert rows[-1]['latestKey']==FINAL
    result={'format':'mumei-thin-prepared-v1','batchId':'yoizora-20260923','createdAt':NOW.isoformat(),'articleChoice':'todayYesterday',
      'sources':['#'+TAG]+['https://note.com/ss_yr/n/'+k for k in SOURCES],'likesCounts':likes_counts,'hashtagPeople':tag_count,
      'count':len(rows),'excluded':excluded,'rows':rows}
    (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print('DONE',len(rows),'excluded',len(excluded),flush=True)

if __name__=='__main__':main()
