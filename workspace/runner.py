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


def prepare_sql_case(con, schema, tables):
    import sqlite3
    for table, cols in schema.items():
        con.execute('CREATE TABLE "'+table+'" ('+','.join('"'+n+'" '+t for n,t in cols)+')')
        rows = tables.get(table, [])
        con.executemany('INSERT INTO "'+table+'" VALUES ('+','.join('?' for _ in cols)+')', rows)
    con.commit()
    con.execute('PRAGMA query_only=ON')
    # SELECTs and CTEs only. Deny writes, attaching databases and PRAGMAs.
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
    con.set_authorizer(lambda action, *args: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)


def preview_sql_plan(payload):
    import sqlite3
    con = sqlite3.connect(':memory:')
    try:
        prepare_sql_case(con, payload['schema'], payload['rows'])
        return con.execute('EXPLAIN QUERY PLAN '+payload['code']).fetchall()
    finally:
        con.close()


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
            prepare_sql_case(con, payload['schema'], case['args'][0])
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
    return dict(results=results,frames=[],syntax=check_sql_learning(payload['code'],payload.get('requirements'),payload.get('schema')),output='\n\n'.join(plans),elapsed=round((time.monotonic()-started)*1000,1),traceTruncated=False)


def check_sql_learning(code, requirements, schema=None):
    """Tutorial structure checks on reachable SQL AST scopes, never string matching."""
    if not requirements:
        return None
    try:
        import sqlglot
        from sqlglot import exp
        from sqlglot.optimizer.scope import build_scope, Scope
        from sqlglot.optimizer.pushdown_projections import pushdown_projections
        from sqlglot.optimizer.qualify import qualify
        statements = sqlglot.parse(code, read='sqlite')
        statements = [s for s in statements if s is not None]
        if len(statements) != 1:
            raise ValueError('Write one SELECT / WITH statement.')
        tree = statements[0]
        # Strip unused projections before checking functions. A decorative unused
        # window expression or unreferenced CTE must not satisfy the learning goal.
        sql_schema = {t:dict(cols) for t,cols in (schema or {}).items()}
        tree = qualify(tree, schema=sql_schema, dialect='sqlite', validate_qualify_columns=False)
        tree = pushdown_projections(tree, schema=sql_schema, dialect='sqlite')
        root = build_scope(tree)
        if root is None:
            raise ValueError('Write a SELECT / WITH query.')
        scopes=[]; seen=set(); references=[]
        def visit(scope):
            if id(scope) in seen: return
            seen.add(id(scope)); scopes.append(scope)
            for _,source in scope.selected_sources.values():
                if isinstance(source,Scope):
                    references.append((scope,source)); visit(source)
            for child in scope.union_scopes + scope.subquery_scopes:
                visit(child)
        visit(root)
        nodes=[]
        for scope in scopes:
            nodes.extend(scope.expression.walk(prune=lambda n: n is not scope.expression and isinstance(n,(exp.Query,exp.CTE))))
        windows=[n for n in nodes if isinstance(n,exp.Window)]
        ctes=[s for s in scopes if s.is_cte]
        checks=[]
        def require(label,condition): checks.append({'label':label,'ok':bool(condition)})
        req=requirements
        if req.get('minCtes'): require('Referenced CTE count: '+str(req['minCtes'])+' or more',len(ctes)>=req['minCtes'])
        if req.get('cteRefs'): require('Use the CTE result in the main query',any(dst.is_cte for src,dst in references))
        if req.get('cteChain'): require('Reference an earlier CTE from a later CTE',any(src.is_cte and dst.is_cte for src,dst in references))
        if req.get('cteReuse'): require('Use the same CTE in two places',any(sum(dst is c for src,dst in references)>=2 for c in ctes))
        for name in req.get('windows',[]): require(name+' OVER(...) used in the calculation',any(isinstance(w.this,exp.Func) and w.this.sql_name()==name for w in windows))
        if req.get('partition'): require('Window PARTITION BY',any(w.args.get('partition_by') for w in windows))
        if req.get('windowOrder'): require('ORDER BY inside the window',any(w.args.get('order') for w in windows))
        if 'frame' in req:
            target=str(req['frame']).upper()
            def frame_matches(w):
                spec=w.args.get('spec')
                if not spec or str(spec.args.get('kind')).upper()!='ROWS': return False
                start=spec.args.get('start'); start=start.sql() if isinstance(start,exp.Expression) else str(start)
                return start.upper()==target and str(spec.args.get('start_side')).upper()=='PRECEDING' and str(spec.args.get('end')).upper()=='CURRENT ROW'
            require('Explicit ROWS frame',any(frame_matches(w) for w in windows))
        for key,arg in [('lagOffset','offset'),('lagDefault','default')]:
            if key in req:
                require('LAG '+arg+' = '+str(req[key]),any(isinstance(w.this,exp.Lag) and isinstance(w.this.args.get(arg),exp.Literal) and w.this.args[arg].this==str(req[key]) for w in windows))
        if req.get('selfJoin'):
            found=False
            for scope in scopes:
                sources=[(alias,node) for alias,(_,node) in scope.selected_sources.items() if isinstance(node,exp.Table)]
                for i,(a,t) in enumerate(sources):
                    for b,u in sources[i+1:]:
                        if a!=b and t.name.lower()==u.name.lower():
                            for join in scope.expression.args.get('joins',[]):
                                on=join.args.get('on')
                                aliases={c.table.lower() for c in on.find_all(exp.Column)} if on else set()
                                if {a.lower(),b.lower()} <= aliases:found=True
            require('Connect two roles of the same table with an ON condition',found)
        if req.get('operator'): require('Relationship condition '+req['operator'],any(n.key.upper()==req['operator'].upper() for n in nodes))
        if req.get('union'):
            unions=[n for n in nodes if isinstance(n,exp.Union)]
            require('UNION ALL' if req['union']=='all' else 'UNION (remove duplicates)',any((u.args.get('distinct') is False)==(req['union']=='all') for u in unions))
        for name in req.get('functions',[]):require(name+' function used',any(isinstance(n,exp.Func) and n.sql_name()==name for n in nodes))
        if req.get('aliases'):
            aliases={a.lower() for s in scopes for a in s.selected_sources}
            require('Role aliases: '+', '.join(req['aliases']),set(req['aliases'])<=aliases)
        if req.get('outerFilter'): require('WHERE in the outer SELECT',bool(tree.args.get('where')))
        if req.get('having'):require('Check group conditions in HAVING',any(isinstance(n,exp.Having) for n in nodes))
        if req.get('caseAggregates'):
            count=sum(isinstance(n,(exp.Sum,exp.Count)) and n.this is not None and bool(n.this.find(exp.Case)) for n in nodes)
            require('Conditional CASE aggregate count: '+str(req['caseAggregates'])+' or more',count>=req['caseAggregates'])
        if req.get('concat'):require('String concatenation with ||',any(isinstance(n,exp.DPipe) for n in nodes))
        if req.get('like'):require('LIKE pattern check',any(isinstance(n,exp.Like) for n in nodes))
        return {'ok':all(c['ok'] for c in checks),'checks':checks}
    except Exception as error:
        return {'ok':False,'checks':[],'error':'Could not validate the syntax structure: '+str(error)}

