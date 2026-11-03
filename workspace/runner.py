import sys, json, io, contextlib, traceback, copy, time
from typing import List

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
                actual=getattr(ns['Solution'](),payload['method'])(*copy.deepcopy(case['args']))
                sys.settrace(None)
                actual=json.loads(json.dumps(actual))
                expected=case.get('expected')
                ok=None if 'expected' not in case else normalize(actual)==normalize(expected)
                results.append(dict(case=index+1,label=case.get("label"),ok=ok,actual=actual,expected=expected))
        except BaseException:
            sys.settrace(None)
            results.append(dict(case=index+1,label=case.get("label"),ok=False,error=traceback.format_exc(limit=6)))
            if time.monotonic()-started>8: break
        finally: sys.settrace(None)
    return dict(results=results,frames=frames,output=output.getvalue(),elapsed=round((time.monotonic()-started)*1000,1),traceTruncated=truncated)
