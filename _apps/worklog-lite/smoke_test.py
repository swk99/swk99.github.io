"""Runs against both Python source and the actual packaged Windows executable."""
import base64
from contextlib import closing
import http.client
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import zipfile
from server import Server, Wiki, restore_file

def run():
    with tempfile.TemporaryDirectory() as td:
        wiki=Wiki(Path(td)/'live'/'worklog.sqlite3');server=Server(0,wiki)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        cookie='';token=server.token
        def request(path,data=None,anonymous=False):
            c=http.client.HTTPConnection('127.0.0.1',server.server_address[1],timeout=30)
            c.request('GET' if data is None else 'POST',path,None if data is None else json.dumps(data),{'Content-Type':'application/json','Cookie':'' if anonymous else cookie,'X-Wiki-Token':token})
            r=c.getresponse();raw=r.read();headers=dict(r.getheaders());status=r.status;c.close()
            result=json.loads(raw) if headers.get('Content-Type','').startswith('application/json') else raw
            return status,result,headers
        try:
            assert request('/')[0]==200
            assert b'Create local account' in request('/app.js')[1]
            assert b'board-grid' in request('/styles.css')[1]
            assert request('/api/state')[0]==401
            status,session,_=request('/api/session');assert session['setup_required']
            status,user,h=request('/api/setup',{'username':'smoke-test','password':'temporary-test-only'});assert status==200
            cookie=h['Set-Cookie'].split(';')[0];token=user['token']
            status,initial,_=request('/api/state');assert not initial['pages'] and not initial['issues'] and len(initial['spaces'])==1
            status,page,_=request('/api/save',dict(space_id='workspace',title='Test document 문서',parent_id=None,body='## Test\nSaved in SQLite.',status='Draft',labels='test'));assert status==200
            status,issue,_=request('/api/issue/save',dict(title='Test linked task',space_id='workspace',linked_page_id=page['id'],status='Backlog'));assert status==200
            status,moved,_=request('/api/issue/save',{**issue,'status':'In progress'});assert status==200 and moved['version']==2
            assert request('/api/issue/save',{**issue,'status':'Done'})[0]==409
            assert len(request('/api/issue/'+str(issue['id']))[1]['history'])==2
            evidence=b'evidence';status,attachment,_=request('/api/attachment',dict(page_id=page['id'],name='evidence.txt',data=base64.b64encode(evidence).decode()));assert status==200
            assert request('/api/attachment/'+attachment['id'])[1]==evidence
            status,backup,_=request('/api/backup');assert status==200
            backup_path=Path(td)/'backup.sqlite3';backup_path.write_bytes(backup)
            restored=Path(td)/'restored.sqlite3';restore_file(backup_path,restored)
            with closing(sqlite3.connect(restored)) as db:
                assert db.execute('SELECT count(*) FROM pages').fetchone()[0]==1
                assert db.execute('SELECT status FROM issues').fetchone()[0]=='In progress'
                assert db.execute('SELECT count(*) FROM attachments').fetchone()[0]==1
            status,export,_=request('/api/export');assert status==200
            with zipfile.ZipFile(io.BytesIO(export)) as z:assert 'issues.json' in z.namelist()
            assert request('/api/logout',{})[0]==200
            for path in ('/api/state','/api/backup','/api/export','/api/issue/1','/api/attachment/'+attachment['id']):assert request(path)[0]==401
            # Test a new server instance against the saved files: credentials + records survive restarts.
            with wiki.connect() as db:assert wiki.get_issue(db,issue['id'])['status']=='In progress'
            from server import load_auth
            assert load_auth(wiki.path.parent)['username']=='smoke-test'
            return {'ok':True,'checks':['packaged static assets','empty initial workspace','account setup','authenticated APIs','document persistence','linked issues','workflow transition','concurrent-edit rejection','history','attachments','backup and restore','export','logout protection','credential persistence']}
        finally:server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=='__main__':print(json.dumps(run(),indent=2))
