import pathlib,json,sys,copy,time
root=pathlib.Path(__file__).resolve().parents[1]/'workspace'
sys.path.insert(0,str(root));from runner import judge,evaluate
problems=json.loads((root/'problems.json').read_text());ed=json.loads((root/'editorials.json').read_text());total=0
for p in problems:
 for method in ed[str(p['id'])]['methods']:
  ns={};exec(method['code'],ns);solve=getattr(ns['Solution'](),p['method'])
  for case in p['tests']+p['extra']:
   result=solve(*copy.deepcopy(case['args']))
   assert judge(p['id'],result,case['expected'],case['args']),(p['id'],method['name'],case,result)
   total+=1
 print(p['id'],'three solutions passed',len(p['tests'])+len(p['extra']))
 # Runtime smoke check uses the recommended implementation over the complete suite.
 payload=dict(problem=p['id'],method=p['method'],code=ed[str(p['id'])]['methods'][0]['code'],mode='submit',tests=p['tests']+p['extra'])
 r=evaluate(payload)
 assert len(r['results'])==len(payload['tests']) and all(x['ok'] for x in r['results']),(p['id'],r['results'])
print('PASS',total,'solution/case comparisons; all recommended solutions passed the browser runner')
assert judge(210,[0,2,1,3],[0,1,2,3],[4,[[1,0],[2,0],[3,1],[3,2]]])
assert not judge(210,[0,1,1,3],[0,1,2,3],[4,[[1,0],[2,0],[3,1],[3,2]]])
assert not judge(1203,[0,2,1], [0,1,2], [3,2,[0,0,1],[[],[],[]]])
assert not judge(269,'ab','',['abc','ab'])
assert not judge(721,[['A','z@x.co','a@x.co']],[['A','a@x.co','z@x.co']],[])
assert judge(1514,0.250001,0.25,[]) and not judge(1514,0.26,0.25,[])
assert not judge(1489,[[1],[0]],[[0],[1]],[])
print('Non-unique output validators reject duplicate IDs, noncontiguous groups, invalid prefixes and unsorted emails')
