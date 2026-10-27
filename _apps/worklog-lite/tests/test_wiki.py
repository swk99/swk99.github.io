import base64
from contextlib import closing
import http.client
import io
import json
import sqlite3
import tempfile
import threading
import unittest
import zipfile
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Wiki, Server, restore_file, password_record, load_auth, save_auth

class WikiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'worklog.sqlite3'
        self.wiki=Wiki(self.path)
        self.server=Server(0,self.wiki,credentials=password_record('testuser','test-password-only'))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.port=self.server.server_address[1]
        self.token=self.server.token
        self.cookie=''
        code,login,headers=self.request('/api/login',{'username':'testuser','password':'test-password-only'})
        self.assertEqual(code,200)
        self.cookie=headers['Set-Cookie'].split(';')[0]
        self.token=login['token']
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def request(self,path,data=None,headers=None,raw=False):
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        hdr={'Content-Type':'application/json','X-Wiki-Token':self.token,'Cookie':self.cookie}
        hdr.update(headers or {})
        conn.request('POST' if data is not None else 'GET',path,json.dumps(data) if data is not None else None,hdr)
        res=conn.getresponse();body=res.read();code=res.status;response_headers=dict(res.getheaders());conn.close()
        return code,(body if raw else json.loads(body)),response_headers
    def create(self,**values):
        p=dict(space_id='workspace',parent_id=None,title='테스트 문서',body='## 검증\n한글 검색 테스트',status='Draft',labels='test, 한글')
        p.update(values);status,p,_=self.request('/api/save',p);self.assertEqual(status,200,p);return p
    def test_seed_persist_update_and_conflict(self):
        s,state,_=self.request('/api/state');self.assertEqual(s,200);self.assertEqual(len(state['spaces']),1);self.assertEqual(len(state['pages']),0)
        p=self.create();old=dict(p);p['body']='Saved text';s,new,_=self.request('/api/save',p);self.assertEqual(s,200);self.assertEqual(new['version'],2)
        s,error,_=self.request('/api/save',old);self.assertEqual(s,409)
        other=Wiki(self.path)
        with other.connect() as db:self.assertEqual(other.get(db,p['id'])['body'],'Saved text')
        s,page,_=self.request('/api/page/'+p['id']);self.assertEqual(len(page['history']),2)
        s,restored,_=self.request('/api/restore',dict(id=p['id'],version=2,restore_version=1));self.assertEqual(s,200);self.assertEqual(restored['version'],3);self.assertIn('한글',restored['body'])
    def test_hierarchy_and_trash(self):
        p=self.create();child=self.create(parent_id=p['id']);p['parent_id']=child['id']
        self.assertEqual(self.request('/api/save',p)[0],400)
        p['parent_id']=None
        self.assertEqual(self.request('/api/trash',dict(id=p['id'],version=1))[0],400)
        self.assertEqual(self.request('/api/trash',dict(id=child['id'],version=1))[0],200)
        self.assertEqual(self.request('/api/trash',dict(id=p['id'],version=1))[0],200)
        s,r,_=self.request('/api/trash',dict(id=child['id'],version=2));self.assertEqual(s,200);self.assertIsNone(r['parent_id']);self.assertFalse(r['deleted'])
    def test_http_security(self):
        self.assertEqual(self.server.server_address[0],'127.0.0.1')
        self.assertEqual(self.request('/api/state',headers={'Host':'attacker.example'})[0],403)
        self.assertEqual(self.request('/api/state',headers={'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('/api/state',headers={'Sec-Fetch-Site':'cross-site'})[0],403)
        self.assertEqual(self.request('/api/space',{'name':'Bad'},headers={'X-Wiki-Token':'bad'})[0],403)
        self.assertEqual(self.request('/api/space',{'name':'Bad'},headers={'Content-Type':'text/plain'})[0],415)
        self.assertEqual(self.request('/../server.py')[0],404)
        self.assertEqual(self.request('/data/worklog.sqlite3')[0],404)
        s,body,headers=self.request('/',raw=True);self.assertEqual(s,200);self.assertIn("frame-ancestors 'none'",headers['Content-Security-Policy']);self.assertNotIn('Access-Control-Allow-Origin',headers)
    def test_attachment_backup_export_restore(self):
        p=self.create();blob=b'test evidence\x00\xff';s,a,_=self.request('/api/attachment',dict(page_id=p['id'],name='검증.txt',data=base64.b64encode(blob).decode()));self.assertEqual(s,200)
        s,out,h=self.request('/api/attachment/'+a['id'],raw=True);self.assertEqual(out,blob);self.assertTrue(h['Content-Disposition'].startswith('attachment;'))
        self.assertEqual(self.request('/api/attachment',dict(page_id=p['id'],name='../evil',data='YQ=='))[0],400)
        self.assertEqual(self.request('/api/attachment',dict(page_id=p['id'],name='bad',data='%%%'))[0],400)
        s,backup,_=self.request('/api/backup',raw=True);self.assertEqual(s,200)
        backup_path=Path(self.temp.name)/'backup.sqlite3';backup_path.write_bytes(backup)
        target=Path(self.temp.name)/'restored.sqlite3';restore_file(backup_path,target)
        with closing(sqlite3.connect(target)) as db:
            self.assertEqual(db.execute('SELECT body FROM pages WHERE id=?',(p['id'],)).fetchone()[0],p['body'])
            self.assertEqual(db.execute('SELECT data FROM attachments WHERE id=?',(a['id'],)).fetchone()[0],blob)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
        restore_file(backup_path,target);self.assertEqual(len(list(target.parent.glob('before-restore-*'))),1)
        s,export,_=self.request('/api/export',raw=True)
        with zipfile.ZipFile(io.BytesIO(export)) as z:
            self.assertIn('attachments/'+a['id']+'/검증.txt',z.namelist());self.assertEqual(len([n for n in z.namelist() if n.endswith('.md')]),1)
    def test_authentication_protects_all_data(self):
        for path in ('/api/state','/api/page/example','/api/backup','/api/export','/api/attachment/anything'):
            code,body,_=self.request(path,headers={'Cookie':''})
            self.assertEqual(code,401,path)
            self.assertNotIn('pages',body)
        self.assertEqual(self.request('/api/save',{},headers={'Cookie':''})[0],401)
        self.assertEqual(self.request('/auth-default.json')[0],404)
        self.assertEqual(self.request('/data/auth.json')[0],404)
        code,session,_=self.request('/api/session',headers={'Cookie':''})
        self.assertFalse(session['authenticated'])
        self.assertNotIn('hash',session)
        self.assertNotEqual(session['token'],self.token)
        # A login bootstrap token does not authorize authenticated mutations.
        self.assertEqual(self.request('/api/space',{'name':'Bad'},headers={'X-Wiki-Token':session['token']})[0],403)
    def test_login_logout_expiry_and_throttling(self):
        self.assertEqual(self.request('/api/logout',{},headers={'X-Wiki-Token':'bad'})[0],403)
        self.assertEqual(self.request('/api/state')[0],200)
        code,body,headers=self.request('/api/logout',{})
        self.assertEqual(code,200);self.assertIn('Max-Age=0',headers['Set-Cookie'])
        self.assertEqual(self.request('/api/state')[0],401)
        self.cookie=''
        self.token=self.request('/api/session')[1]['token']
        for i in range(5):
            self.assertEqual(self.request('/api/login',{'username':'testuser','password':'incorrect'})[0],401)
        self.assertEqual(self.request('/api/login',{'username':'testuser','password':'test-password-only'})[0],429)
        self.server.blocked_until=0
        code,login,headers=self.request('/api/login',{'username':'testuser','password':'test-password-only'})
        self.assertEqual(code,200);self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertIn('SameSite=Strict',headers['Set-Cookie'])
        self.cookie=headers['Set-Cookie'].split(';')[0];self.token=login['token']
        self.assertEqual(self.request('/api/state')[0],200)
        for session in self.server.sessions.values():session['expires']=0
        self.assertEqual(self.request('/api/state')[0],401)
    def test_password_config_persists_without_plaintext(self):
        record=password_record('owner','a-test-password')
        self.assertNotIn('a-test-password',json.dumps(record))
        self.assertNotEqual(record['salt'],password_record('owner','a-test-password')['salt'])
        save_auth(Path(self.temp.name)/'auth.json',record)
        self.assertEqual(load_auth(self.temp.name),record)

    def test_first_run_setup_is_single_use(self):
        self.server.credentials=None;self.cookie='';self.token=self.server.token
        self.assertTrue(self.request('/api/session')[1]['setup_required'])
        self.assertEqual(self.request('/api/setup',{'username':'owner','password':'short'})[0],400)
        code,result,headers=self.request('/api/setup',{'username':'owner','password':'long-test-password'})
        self.assertEqual(code,200)
        self.assertEqual(load_auth(self.path.parent)['username'],'owner')
        self.assertEqual(self.request('/api/setup',{'username':'attacker','password':'other-test-password'})[0],409)
        self.assertFalse(self.request('/api/session')[1]['setup_required'])
    def test_issue_link_transition_validation_and_trash(self):
        page=self.create()
        code,issue,_=self.request('/api/issue/save',{'space_id':'workspace','title':'Linked test','linked_page_id':page['id']})
        self.assertEqual(code,200);self.assertEqual(issue['status'],'Backlog')
        code,updated,_=self.request('/api/issue/save',{**issue,'status':'In progress','due_date':'2026-11-01'})
        self.assertEqual(code,200);self.assertEqual(updated['version'],2)
        self.assertEqual(self.request('/api/issue/save',{**issue,'status':'Done'})[0],409)
        self.assertEqual(self.request('/api/issue/save',{**updated,'due_date':'2026-02-30'})[0],400)
        self.assertEqual(self.request('/api/issue/save',{**updated,'priority':'invalid'})[0],400)
        self.assertEqual(self.request('/api/issue/save',{**updated,'linked_page_id':'missing'})[0],404)
        code,trashed,_=self.request('/api/issue/trash',{'id':issue['id'],'version':2})
        self.assertEqual(code,200);self.assertEqual(trashed['deleted'],1)
        self.assertEqual(self.request('/api/issue/save',trashed)[0],400)
        code,restored,_=self.request('/api/issue/trash',{'id':issue['id'],'version':3})
        self.assertEqual(code,200);self.assertFalse(restored['deleted'])
        self.assertEqual(len(self.request('/api/issue/'+str(issue['id']))[1]['history']),4)

    def test_validation_and_spaces(self):
        self.assertEqual(self.request('/api/save',{'title':''})[0],400)
        self.assertEqual(self.request('/api/space',{'name':'','description':''})[0],400)
        s,space,_=self.request('/api/space',{'name':'새 공간','description':'로컬 문서'});self.assertEqual(s,200)
        p=self.create(space_id=space['id']);s,star,_=self.request('/api/favorite',{'id':p['id'],'version':1});self.assertEqual(star['favorite'],1)
        p['status']='unknown';self.assertEqual(self.request('/api/save',p)[0],400)
        p['status']='Draft';p['parent_id']='missing-parent';self.assertEqual(self.request('/api/save',p)[0],404)

if __name__=='__main__':unittest.main(verbosity=2)
