"""Validate both coursework collections through the workspace's actual SQL judge."""
import json
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[1] / 'workspace'
sys.path.insert(0, str(root))
from runner import evaluate_sql
count = 0
ids = set()
for filename in ('sql-study.json', 'kodori-sql.json'):
    course = json.loads((root / filename).read_text())
    for lesson in course['lessons']:
        assert lesson['id'] not in ids
        ids.add(lesson['id'])
        data = course['datasets'][lesson['dataset']]
        cases = [dict(args=[data[k]], expected=lesson['expected'][k]) for k in ('example', 'edge')]
        payload = dict(schema=data['schema'], code=lesson['solution'], columns=lesson['columns'], ordered=lesson['ordered'], tests=cases, mode='submit')
        result = evaluate_sql(payload)
        assert all(r['ok'] for r in result['results']), (lesson['id'], result)
        count += len(cases)
        # Check conceptual examples really execute against the declared lesson dataset.
        payload.update(code=lesson['conceptExample']['sql'], tests=[dict(args=[data['example']])])
        assert 'error' not in evaluate_sql(payload)['results'][0], lesson['id']
        # A syntactically valid but wrong result must fail, not mark progress complete.
        payload.update(code='SELECT 0 AS wrong', tests=cases)
        assert not any(r['ok'] for r in evaluate_sql(payload)['results'])
course = json.loads((root / 'kodori-sql.json').read_text())
lessons = {p['id'].removeprefix('kodori-sql-'):p for p in course['lessons']}
assert len(lessons) == 33
assert len({p['level'] for p in lessons.values()}) == 11
# Independent hand-computed anchors for the concepts most prone to subtle errors.
assert sorted(r[2] for r in lessons['rank']['expected']['example']) == [1,2,2,4]
assert len(lessons['dense']['expected']['example']) == 3
assert lessons['lag']['expected']['example'][0][2] is None
assert lessons['running']['expected']['edge'] == [['2026-02-01',25,25],['2026-02-03',25,50],['2026-02-05',15,65]]
assert len(lessons['union-all']['expected']['example']) == 5
assert len(lessons['union']['expected']['example']) == 3
assert lessons['pivot-two']['expected']['edge'] == [[60,0]]
assert sorted(lessons['case-finale']['expected']['edge']) == sorted([['곰',20,1],['여우',20,1],['토끼',20,1]])
print(f'PASS: {count} solution/dataset cases, all concept examples, incorrect-query rejection, and independent semantic checks')

assert lessons['cte-first']['expected']['example'] == [['잎사귀',10],['도토리',20]]
assert lessons['order-filter']['expected']['example'] == [['잎사귀',10,30],['도토리',20,30]]
assert lessons['order-cte']['expected']['example'] == [['잎사귀',10,80],['도토리',20,80]]
assert lessons['self-pairs']['expected']['example'] == [['코돌이','토끼']]
assert 'hello' not in lessons and 'where' not in lessons and 'sum' not in lessons
