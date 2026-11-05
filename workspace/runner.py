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
