import sys, json, io, contextlib, traceback, copy, time
from typing import List

def judge(problem, actual, expected, args):
    """Validate non-unique answers without accepting invalid internal ordering."""
    import math
    if problem == 49:
        if not isinstance(actual, list) or any(not isinstance(g, list) or any(not isinstance(s, str) for s in g) for g in actual): return False
        return sorted(sorted(g) for g in actual) == sorted(sorted(g) for g in expected)
    if problem == 5:
        return isinstance(actual, str) and actual in args[0] and actual == actual[::-1] and len(actual) == len(expected)
    if problem == 443:
        return isinstance(actual, dict) and type(actual.get('length')) == int and actual == expected
    if problem == 1514:
        return type(actual) in (int, float) and math.isfinite(actual) and abs(actual-expected) <= 1e-5
    if problem == 721:
        if not isinstance(actual,list) or any(not isinstance(row,list) or any(not isinstance(x,str) for x in row) for row in actual): return False
        return sorted(actual) == sorted(expected)
    if problem in (1192,1489):
        if not isinstance(actual,list) or any(not isinstance(row,list) or any(type(x)!=int for x in row) for row in actual): return False
        if problem == 1192:return sorted(sorted(edge) for edge in actual)==sorted(sorted(edge) for edge in expected)
        return len(actual)==2 and all(sorted(a)==sorted(b) for a,b in zip(actual,expected))
    if problem in (210,1203):
        n=args[0]
        if not isinstance(actual,list):return False
        if not actual:return expected == []
        if len(actual)!=n or any(type(x)!=int for x in actual) or set(actual)!=set(range(n)):return False
        pos={v:i for i,v in enumerate(actual)}
        if problem==210:return all(pos[b]<pos[a] for a,b in args[1])
        group,before=args[2],args[3]
        if any(pos[u]>=pos[v] for v,previous in enumerate(before) for u in previous):return False
        ranges={}
        for i,g in enumerate(group):
            if g>=0:ranges.setdefault(g,[]).append(pos[i])
        return all(max(p)-min(p)+1==len(p) for p in ranges.values())
    if problem==269:
        if not isinstance(actual,str):return False
        if not actual:return expected==''
        words=args[0];chars=set(''.join(words))
        if len(actual)!=len(chars) or set(actual)!=chars:return False
        rank={c:i for i,c in enumerate(actual)}
        for a,b in zip(words,words[1:]):
            for x,y in zip(a,b):
                if x!=y:
                    if rank[x]>=rank[y]:return False
                    break
            else:
                if len(a)>len(b):return False
        return True
    if isinstance(expected,bool):return type(actual)==bool and actual==expected
    if isinstance(expected,int):return type(actual)==int and actual==expected
    return actual==expected


def evaluate(payload):
    if payload.get("language")=="sql": return evaluate_sql(payload)
    frames=[]; results=[]; output=io.StringIO(); started=time.monotonic(); steps=0; case_frames=0; truncated=False
    class LimitedOutput(io.StringIO):
        def write(self, text):
            if self.tell()+len(text)>50000: raise RuntimeError('Console output limit (50 KB) reached')
            return super().write(text)
    output=LimitedOutput()
    def trace(frame,event,arg):
        nonlocal steps, case_frames, truncated
        if frame.f_code.co_filename=='solution.py':
            steps+=1
            if steps>200000 or time.monotonic()-started>8:
                raise RuntimeError('Execution limit reached; simplify your code or use a smaller input')
            if payload['mode']=='debug' and event in ('line','return') and case_frames<2500:
                vals={}
                for k,v in list(frame.f_locals.items())[:30]:
                    if k!='self' and not k.startswith('__'):
                        try: vals[k]=repr(v)[:350]
                        except Exception: vals[k]='<unavailable>'
                case_frames+=1
                frames.append(dict(case=index+1,label=case.get('label', 'Example '+str(index+1)),line=frame.f_lineno,event=event,function=frame.f_code.co_name,locals=vals))
            elif payload['mode']=='debug' and event in ('line','return'):
                truncated=True
        return trace
    def normalize(value):
        if payload['problem']==1192:
            return sorted(sorted(edge) for edge in value)
        return value
    for index,case in enumerate(payload['tests']):
        steps=0; case_frames=0
        ns={'List':List,'__name__':'__main__'}
        try:
            with contextlib.redirect_stdout(output),contextlib.redirect_stderr(output):
                sys.settrace(trace)
                exec(compile(payload['code'],'solution.py','exec'),ns)
                call_args=copy.deepcopy(case['args'])
                actual=getattr(ns['Solution'](),payload['method'])(*call_args)
                if payload['problem']==443:
                    actual={'length':actual,'chars':call_args[0][:actual] if type(actual)==int and 0<=actual<=len(call_args[0]) else None}
                sys.settrace(None)
                actual=json.loads(json.dumps(actual))
                expected=case.get('expected')
                ok=None if 'expected' not in case else judge(payload['problem'],actual,expected,case['args'])
                results.append(dict(case=index+1,label=case.get("label"),ok=ok,actual=actual,expected=expected))
        except BaseException:
            sys.settrace(None)
            results.append(dict(case=index+1,label=case.get("label"),ok=False,error=traceback.format_exc(limit=6)))
            if time.monotonic()-started>8: break
        finally: sys.settrace(None)
    return dict(results=results,frames=frames,output=output.getvalue(),elapsed=round((time.monotonic()-started)*1000,1),traceTruncated=truncated)


# Browser-local SQLite execution. Every case gets a separate, disposable database.
def evaluate_sql(payload):
    import sqlite3, math
    results=[]; plans=[]; started=time.monotonic()
    def same(a,b):
        if isinstance(a,(int,float)) and isinstance(b,(int,float)):
            return math.isfinite(a) and abs(a-b)<=1e-6
        return type(a)==type(b) and a==b
    def row_equal(a,b): return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
    for index,case in enumerate(payload['tests']):
        con=sqlite3.connect(':memory:')
        try:
            for table,cols in payload['schema'].items():
                con.execute('CREATE TABLE "'+table+'" ('+','.join('"'+n+'" '+t for n,t in cols)+')')
                rows=case['args'][0].get(table,[])
                con.executemany('INSERT INTO "'+table+'" VALUES ('+','.join('?' for _ in cols)+')',rows)
            con.commit()
            con.execute('PRAGMA query_only=ON')
            # SELECTs/CTEs only; deny side effects, attaching databases and PRAGMAs.
            allowed={sqlite3.SQLITE_SELECT,sqlite3.SQLITE_READ,sqlite3.SQLITE_FUNCTION,sqlite3.SQLITE_RECURSIVE}
            con.set_authorizer(lambda action,*args: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)
            deadline=time.monotonic()+5
            con.set_progress_handler(lambda: int(time.monotonic()>deadline),1000)
            code=payload['code'].strip()
            cursor=con.execute(code)
            if cursor.description is None: raise ValueError('Write a SELECT or WITH query that returns rows.')
            columns=[c[0] for c in cursor.description]
            rows=[list(r) for r in cursor.fetchmany(10001)]
            if len(rows)>10000: raise ValueError('Result limit: 10,000 rows.')
            expected=case.get('expected')
            ok=None
            if expected is not None:
                ok=columns==payload['columns'] and len(rows)==len(expected)
                if ok and payload.get('ordered'):
                    ok=all(row_equal(a,b) for a,b in zip(rows,expected))
                elif ok:
                    remaining=list(expected)
                    for row in rows:
                        hit=next((i for i,r in enumerate(remaining) if row_equal(row,r)),None)
                        if hit is None: ok=False; break
                        remaining.pop(hit)
            results.append(dict(case=index+1,label=case.get('label'),ok=ok,actual={'columns':columns,'rows':rows},expected=None if expected is None else {'columns':payload['columns'],'rows':expected}))
            if payload['mode']=='debug':
                plans.append('Case '+str(index+1)+' · EXPLAIN QUERY PLAN\n'+'\n'.join(str(r) for r in con.execute('EXPLAIN QUERY PLAN '+code)))
        except BaseException as e:
            results.append(dict(case=index+1,label=case.get('label'),ok=False,error=str(e)))
        finally:
            con.close()
    return dict(results=results,frames=[],output='\n\n'.join(plans),elapsed=round((time.monotonic()-started)*1000,1),traceTruncated=False)
