"""Run all course answers in the real SQLite judge and verify retained task contracts.
Install the pinned wheel in workspace/vendor before running this test locally.
"""
import collections
import hashlib
import json
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[1] / 'workspace'
sys.path.insert(0, str(root))
from runner import evaluate_sql, check_sql_learning

def load(name): return json.loads((root / name).read_text())
def contract(l, datasets):
    keys=('id','file','title','dataset','rules','solution','starter','columns','ordered','expected')
    return {**{k:l.get(k) for k in keys},'data':datasets[l['dataset']]}
def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()

course=load('kodori-sql.json'); archive=load('kodori-sql-archive.json')
assert len(course['lessons'])==48
chapters=collections.Counter(l['level'] for l in course['lessons'])
assert len(chapters)==11 and all(3<=n<=5 for n in chapters.values()),chapters
ids=set();total=0
for source in [course,archive,load('sql-study.json')]:
    for l in source['lessons']:
        assert l['id'] not in ids,l['id'];ids.add(l['id'])
        data=source['datasets'][l['dataset']]
        cases=[dict(label=k,args=[data[k]],expected=l['expected'][k]) for k in ('example','edge')]
        payload=dict(schema=data['schema'],code=l['solution'],columns=l['columns'],ordered=l['ordered'],tests=cases,mode='submit',requirements=l.get('requirements'))
        result=evaluate_sql(payload)
        assert all(r['ok'] for r in result['results']),(l['id'],result)
        assert not result['syntax'] or result['syntax']['ok'],(l['id'],result['syntax'])
        total+=len(cases)
        if l.get('referenceSql'):
            reference=evaluate_sql({**payload,'code':l['referenceSql'],'requirements':None})
            assert all(r['ok'] for r in reference['results']),(l['id'],'refactor changes original result',reference)
        concept=evaluate_sql({**payload,'code':l['conceptExample']['sql'],'requirements':None,'tests':[dict(args=[data['example']])]})
        assert 'error' not in concept['results'][0],(l['id'],concept)
        wrong=evaluate_sql({**payload,'code':'SELECT 0 AS wrong','requirements':None})
        assert not any(r['ok'] for r in wrong['results']),l['id']
        if source is course:
            assert l.get('syntax') and l.get('why') and l.get('pitfall') and l.get('newElement')
            assert len(l['hints'])==3
            assert l.get('requirements')
            if l['stage']==1:assert 3<=sum(len(rows) for rows in data['example'].values())<=6,l['id']
# Freeze historical identity and answer contract across course moves.
legacy=json.loads((root.parent/'test/kodori_legacy_manifest.json').read_text())
all_lessons={l['id']:(l,src['datasets']) for src in [course,archive] for l in src['lessons']}
for id_,expected_hash in legacy.items():
    l,datasets=all_lessons[id_]
    assert digest(contract(l,datasets))==expected_hash,('historical problem changed',id_)

by={l['id'].removeprefix('kodori-sql-'):l for l in course['lessons']}
def rows(slug,kind='example'):return by[slug]['expected'][kind]
# Hand-calculated anchors independent of the reference query.
assert sorted(r[2] for r in rows('rank'))==[1,2,2,4]
assert sorted(r[2] for r in rows('v3-ranking-dense'))==[1,2,2,3]
assert rows('v3-lag-offset')==[['2026-01-01',10,None],['2026-01-02',30,None],['2026-01-04',20,10]]
assert rows('v3-lag-default')==[['2026-01-01',10,0],['2026-01-02',30,0],['2026-01-04',20,10]]
assert rows('v3-pivot-count')==[[2,2]]
assert sorted(rows('v3-pivot-rate','edge'))==sorted([['산',2,0,0.0],['숲',0,1,1.0],['강',0,0,None]])
assert sorted(rows('v3-string-repair-pattern'))==[[1,'UK-001'],[2,'UK-002'],[6,'UK-006']]
assert rows('v3-order-alias')==[['도토리',40],['열매',40],['차',60]]
assert sorted(rows('v3-basket-gap-report'))==[['Bread','Pantry',4.0,2],['Milk','Pantry',2.0,1]]
assert sorted(r[-1] for r in rows('v3-window-moving'))==[5.0,10.0,10.0,20.0,20.0,20.0]
# Reject keywords in comments, unused CTEs, and unused window expressions.
schema=course['datasets']['snacks']['schema']
assert not check_sql_learning('SELECT name FROM snacks -- WITH x AS (SELECT 1)',{'minCtes':1},schema)['ok']
assert not check_sql_learning('WITH unused AS (SELECT * FROM snacks) SELECT name FROM snacks',{'minCtes':1},schema)['ok']
assert not check_sql_learning('WITH unused AS (SELECT SUM(amount) OVER () AS s FROM snacks) SELECT name FROM snacks',{'windows':['SUM']},schema)['ok']
assert not check_sql_learning('WITH data AS (SELECT name, SUM(amount) OVER () AS unused FROM snacks) SELECT name FROM data',{'windows':['SUM']},schema)['ok']
assert not check_sql_learning("SELECT 'ROW_NUMBER() OVER ()' AS note FROM snacks",{'windows':['ROW_NUMBER']},schema)['ok']
# Correct rows via a different technique don't meet this lesson's syntax objective.
l=by['window-all'];data=course['datasets'][l['dataset']]
r=evaluate_sql(dict(schema=data['schema'],code='SELECT name, amount, (SELECT SUM(amount) FROM snacks) AS grand_total FROM snacks',columns=l['columns'],ordered=False,tests=[dict(args=[data['example']],expected=l['expected']['example'])],mode='submit',requirements=l['requirements']))
assert r['results'][0]['ok'] and not r['syntax']['ok']
print(f'PASS: {total} SQLite answer/data cases; all syntax goals; refactor equivalence; {len(legacy)} preserved IDs/contracts; conceptual and adversarial checks')
