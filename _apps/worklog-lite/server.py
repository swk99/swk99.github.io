"""Worklog Lite — offline, single-user, loopback-only. Python 3.11+ standard library."""
import argparse
import base64
import binascii
import io
import hashlib
import getpass
import time
import threading
from http.cookies import SimpleCookie, CookieError
import json
import os
import re
import secrets
import sqlite3
import tempfile
import uuid
from contextlib import contextmanager, closing
import zipfile
from datetime import datetime, timezone, date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote

ROOT = Path(__file__).resolve().parent
STATUS = {'Draft', 'In progress', 'In review', 'Complete'}
ISSUE_STATUS = {'Backlog', 'To do', 'In progress', 'In review', 'Done'}
SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pages(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), parent_id TEXT REFERENCES pages(id), title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, labels TEXT NOT NULL, version INTEGER NOT NULL, updated TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS versions(page_id TEXT NOT NULL REFERENCES pages(id), version INTEGER NOT NULL, snapshot TEXT NOT NULL, note TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY(page_id,version));
CREATE TABLE IF NOT EXISTS issues(id INTEGER PRIMARY KEY AUTOINCREMENT, space_id TEXT NOT NULL REFERENCES spaces(id), title TEXT NOT NULL, description TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, assignee TEXT NOT NULL, due_date TEXT NOT NULL, labels TEXT NOT NULL, linked_page_id TEXT REFERENCES pages(id), version INTEGER NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS issue_versions(issue_id INTEGER NOT NULL REFERENCES issues(id), version INTEGER NOT NULL, snapshot TEXT NOT NULL, note TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY(issue_id,version));
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id), name TEXT NOT NULL, data BLOB NOT NULL, created TEXT NOT NULL);
'''

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

class Problem(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def password_record(username, password):
    if not isinstance(username, str) or not username.strip() or len(username) > 80:
        raise ValueError('Username must contain 1–80 characters.')
    if not isinstance(password, str) or not 8 <= len(password) <= 1024:
        raise ValueError('Password must contain 8–1024 characters.')
    salt = secrets.token_bytes(32)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000)
    return {'username': username.strip(), 'algorithm': 'pbkdf2-sha256', 'iterations': 600000, 'salt': salt.hex(), 'hash': digest.hex()}

def save_auth(path, record):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with tmp.open('x', encoding='utf-8') as f:
            os.chmod(tmp, 0o600)
            json.dump(record, f)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)

def load_auth(directory):
    path = Path(directory) / 'auth.json'
    if not path.exists():
        return None
    record = json.loads(path.read_text(encoding='utf-8'))
    if record.get('algorithm') != 'pbkdf2-sha256' or record.get('iterations') != 600000 or len(bytes.fromhex(record['salt'])) != 32 or len(bytes.fromhex(record['hash'])) != 32:
        raise ValueError('Invalid login configuration. Use --set-password to reset it.')
    return record

class Wiki:
    def __init__(self, path, seed=True):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript(SCHEMA)
            db.execute("INSERT OR IGNORE INTO meta VALUES ('schema_version', '2')")
            db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('instance', uuid.uuid4().hex))
            if seed and not db.execute('SELECT 1 FROM spaces').fetchone():
                from seed import SPACES, PAGES
                db.executemany('INSERT INTO spaces VALUES (?,?,?)', SPACES)
                for p in PAGES:
                    self.save(db, p, new=True, note='Starter draft — verify against your records')
    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()
    def get(self, db, pid):
        row = db.execute('SELECT * FROM pages WHERE id=?', (pid,)).fetchone()
        if not row:
            raise Problem('Page not found.', 404)
        return dict(row)
    def history(self, db, page, note):
        db.execute('INSERT INTO versions VALUES (?,?,?,?,?)', (page['id'], page['version'], json.dumps(page, ensure_ascii=False), note[:500], now()))
    def save(self, db, data, new=False, note=None):
        pid = data.get('id', uuid.uuid4().hex)
        if not isinstance(pid, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', pid):
            raise Problem('Invalid page ID.')
        previous = None if new else self.get(db, pid)
        if previous and data.get('version') != previous['version']:
            raise Problem('This page changed in another tab. Copy your draft, reopen the page, and merge your changes.', 409)
        fields = ('space_id', 'parent_id', 'title', 'body', 'status', 'labels')
        p = {k: data.get(k, previous.get(k) if previous else '') for k in fields}
        for k in ('space_id', 'title', 'body', 'status', 'labels'):
            if not isinstance(p[k], str):
                raise Problem('Invalid ' + k)
        p['title'] = p['title'].strip()
        if not p['title'] or len(p['title']) > 200 or len(p['body']) > 1_000_000 or len(p['labels']) > 500:
            raise Problem('Title is required (max 200 characters). Body limit: 1 million characters; labels: 500.')
        if p['status'] not in STATUS:
            raise Problem('Invalid status.')
        if not db.execute('SELECT 1 FROM spaces WHERE id=?', (p['space_id'],)).fetchone():
            raise Problem('Choose an existing space.')
        p['parent_id'] = p['parent_id'] or None
        if p['parent_id'] and not isinstance(p['parent_id'], str):
            raise Problem('Invalid parent.')
        seen = {pid}
        parent = p['parent_id']
        while parent:
            if parent in seen:
                raise Problem('A page cannot be its own ancestor.')
            seen.add(parent)
            pr = self.get(db, parent)
            if pr['space_id'] != p['space_id'] or pr['deleted']:
                raise Problem('Parent must be an active page in the same space.')
            parent = pr['parent_id']
        if previous and previous['space_id'] != p['space_id'] and db.execute('SELECT 1 FROM issues WHERE linked_page_id=? AND deleted=0',(pid,)).fetchone():
            raise Problem('Unlink active issues before moving this document to another space.')
        if previous and previous['space_id'] != p['space_id'] and db.execute('SELECT 1 FROM pages WHERE parent_id=?', (pid,)).fetchone():
            raise Problem('Move child pages first before changing this page’s space.')
        p.update(id=pid, version=(previous['version']+1 if previous else 1), updated=now(), favorite=(previous['favorite'] if previous else 0), deleted=(previous['deleted'] if previous else 0))
        if new:
            db.execute('INSERT INTO pages(id,space_id,parent_id,title,body,status,labels,version,updated,favorite,deleted) VALUES(:id,:space_id,:parent_id,:title,:body,:status,:labels,:version,:updated,:favorite,:deleted)', p)
        else:
            db.execute('UPDATE pages SET space_id=:space_id,parent_id=:parent_id,title=:title,body=:body,status=:status,labels=:labels,version=:version,updated=:updated WHERE id=:id', p)
        self.history(db, p, note or str(data.get('note', 'Page updated')))
        return p
    def get_issue(self, db, iid):
        row = db.execute('SELECT * FROM issues WHERE id=?',(iid,)).fetchone()
        if not row:
            raise Problem('Issue not found.',404)
        return dict(row)
    def issue_history(self,db,issue,note):
        db.execute('INSERT INTO issue_versions VALUES (?,?,?,?,?)',(issue['id'],issue['version'],json.dumps(issue,ensure_ascii=False),note[:500],now()))
    def save_issue(self,db,data):
        previous = self.get_issue(db,data['id']) if data.get('id') else None
        if previous and previous['version'] != data.get('version'):
            raise Problem('This issue changed in another tab. Reload before saving.',409)
        if previous and previous['deleted']:
            raise Problem('Restore this issue from trash first.')
        defaults = dict(space_id='workspace', title='', description='', kind='Task', status='Backlog', priority='Medium', assignee='', due_date='', labels='', linked_page_id=None)
        issue = {k:data.get(k,previous[k] if previous else v) for k,v in defaults.items()}
        for key,limit in {'space_id':80,'title':200,'description':1000000,'kind':20,'status':20,'priority':20,'assignee':100,'due_date':10,'labels':500}.items():
            if not isinstance(issue[key],str) or len(issue[key])>limit:
                raise Problem('Invalid '+key)
        issue['title']=issue['title'].strip()
        if not issue['title'] or issue['status'] not in ISSUE_STATUS or issue['kind'] not in {'Task','Bug','Story'} or issue['priority'] not in {'Low','Medium','High','Critical'}:
            raise Problem('A title and valid issue fields are required.')
        if issue['due_date']:
            try:
                date.fromisoformat(issue['due_date'])
            except ValueError:
                raise Problem('Choose a valid due date (YYYY-MM-DD).')
        if not db.execute('SELECT 1 FROM spaces WHERE id=?',(issue['space_id'],)).fetchone():
            raise Problem('Choose an existing space.')
        issue['linked_page_id']=issue['linked_page_id'] or None
        if issue['linked_page_id']:
            if not isinstance(issue['linked_page_id'],str):
                raise Problem('Invalid linked document.')
            page=self.get(db,issue['linked_page_id'])
            if page['deleted'] or page['space_id']!=issue['space_id']:
                raise Problem('Choose an active document in this space.')
        issue.update(version=previous['version']+1 if previous else 1,created=previous['created'] if previous else now(),updated=now(),deleted=0)
        if previous:
            issue['id']=previous['id']
            db.execute('UPDATE issues SET space_id=:space_id,title=:title,description=:description,kind=:kind,status=:status,priority=:priority,assignee=:assignee,due_date=:due_date,labels=:labels,linked_page_id=:linked_page_id,version=:version,updated=:updated WHERE id=:id',issue)
        else:
            cur=db.execute('INSERT INTO issues(space_id,title,description,kind,status,priority,assignee,due_date,labels,linked_page_id,version,created,updated,deleted) VALUES(:space_id,:title,:description,:kind,:status,:priority,:assignee,:due_date,:labels,:linked_page_id,:version,:created,:updated,:deleted)',issue)
            issue['id']=cur.lastrowid
        self.issue_history(db,issue,'Created' if previous is None else 'Updated')
        return issue
    def backup(self):
        with tempfile.TemporaryDirectory() as td:
            target = Path(td)/'worklog.sqlite3'
            with self.connect() as source, closing(sqlite3.connect(target)) as dest:
                source.backup(dest)
            return target.read_bytes()
    def export(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as z, self.connect() as db:
            for row in db.execute('SELECT * FROM pages WHERE deleted=0'):
                p = dict(row)
                safe = re.sub(r'[^\w .-]', '_', p['title'])[:100]
                z.writestr(f"{p['space_id']}/{safe}-{p['id']}.md", f"# {p['title']}\n\nStatus: {p['status']}\nLabels: {p['labels']}\nVersion: {p['version']}\n\n{p['body']}\n")
            for a in db.execute('SELECT * FROM attachments'):
                z.writestr(f"attachments/{a['id']}/{a['name']}", a['data'])
            z.writestr('issues.json',json.dumps([dict(r) for r in db.execute('SELECT * FROM issues')],ensure_ascii=False,indent=2))
            z.writestr('README.txt', 'Markdown export, not a full restore backup. Use the SQLite backup for pages, history, spaces and attachments.\n')
        return output.getvalue()

class Handler(BaseHTTPRequestHandler):
    server_version = 'Worklog/1.0'
    def log_message(self, *args):
        pass
    def send(self, value, code=200, ctype='application/json; charset=utf-8', filename=None, cookie=None):
        payload = json.dumps(value, ensure_ascii=False).encode() if ctype.startswith('application/json') else value
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if filename:
            self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(filename, safe=''))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(payload)
    def guard(self, write=False, login=False):
        port = self.server.server_address[1]
        allowed = {f'127.0.0.1:{port}', f'localhost:{port}'}
        if self.headers.get('Host') not in allowed:
            raise Problem('Only direct localhost access is allowed.', 403)
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            raise Problem('Cross-site requests are blocked.', 403)
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://' + h for h in allowed}:
            raise Problem('Origin blocked.', 403)
        if write:
            expected = self.server.token if login else self.require_session()['token']
            supplied = self.headers.get('X-Wiki-Token', '')
            if not secrets.compare_digest(supplied.encode(), expected.encode()):
                raise Problem('Session expired. Reload the page.', 403)
    def session_id(self):
        try:
            cookies = SimpleCookie(self.headers.get('Cookie', ''))
            item = cookies.get(self.server.cookie_name)
            return item.value if item else ''
        except CookieError:
            return ''
    def require_session(self, required=True):
        sid = self.session_id()
        with self.server.auth_lock:
            session = self.server.sessions.get(sid)
            if session and session['expires'] <= time.time():
                del self.server.sessions[sid]
                session = None
        if not session and required:
            raise Problem('Please sign in to your workspace.', 401)
        return session
    def login(self, data):
        username, password = data.get('username'), data.get('password')
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 80 or len(password) > 1024:
            raise Problem('Invalid username or password.', 401)
        with self.server.auth_lock:
            clock = time.monotonic()
            if clock < self.server.blocked_until:
                raise Problem('Too many attempts. Wait 60 seconds and try again.', 429)
            record = self.server.credentials
            if record is None:
                raise Problem('Create your local account first.', 409)
            digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(record['salt']), record['iterations'])
            valid_hash = secrets.compare_digest(digest, bytes.fromhex(record['hash']))
            valid_user = secrets.compare_digest(username.encode(), record['username'].encode())
            if not (valid_hash and valid_user):
                self.server.failures = [t for t in self.server.failures if t > clock - 300]
                self.server.failures.append(clock)
                if len(self.server.failures) >= 5:
                    self.server.blocked_until = clock + 60
                    self.server.failures = []
                raise Problem('Invalid username or password.', 401)
            self.server.failures = []
            self.server.sessions = {k:v for k,v in self.server.sessions.items() if v['expires'] > time.time()}
            self.server.sessions.pop(self.session_id(), None)
            sid = secrets.token_urlsafe(32)
            session = {'token':secrets.token_urlsafe(32), 'expires':time.time()+8*60*60}
            self.server.sessions[sid] = session
        cookie = f'{self.server.cookie_name}={sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'
        self.send({'authenticated':True, 'token':session['token'], 'username':record['username']}, cookie=cookie)
    def setup_account(self, data):
        with self.server.auth_lock:
            if self.server.credentials is not None:
                raise Problem('An account already exists.', 409)
            try:
                record = password_record(data.get('username'), data.get('password'))
            except ValueError as e:
                raise Problem(str(e))
            save_auth(self.server.wiki.path.parent / 'auth.json', record)
            self.server.credentials = record
        self.login(data)
    def do_GET(self):
        try:
            self.guard()
            path = unquote(urlsplit(self.path).path)
            wiki = self.server.wiki
            if path == '/api/health':
                self.send({'app':'WorklogLite','version':'0.1.0'})
                return
            if path == '/api/session':
                session = self.require_session(required=False)
                self.send({'authenticated':bool(session), 'setup_required':self.server.credentials is None, 'token':session['token'] if session else self.server.token})
                return
            session = self.require_session() if path.startswith('/api/') else None
            if path == '/api/state':
                with wiki.connect() as db:
                    self.send({'spaces':[dict(r) for r in db.execute('SELECT * FROM spaces ORDER BY rowid')], 'pages':[dict(r) for r in db.execute('SELECT * FROM pages ORDER BY updated DESC, rowid DESC')], 'issues':[dict(r) for r in db.execute('SELECT * FROM issues ORDER BY updated DESC, id DESC')], 'token':session['token'], 'username':self.server.credentials['username'], 'instance':db.execute("SELECT value FROM meta WHERE key='instance'").fetchone()[0]})
            elif path.startswith('/api/issue/'):
                with wiki.connect() as db:
                    issue = wiki.get_issue(db, path.split('/')[-1])
                    issue['history'] = [dict(r) for r in db.execute('SELECT version,note,created,snapshot FROM issue_versions WHERE issue_id=? ORDER BY version DESC',(issue['id'],))]
                    self.send(issue)
            elif path.startswith('/api/page/'):
                pid = path.split('/')[-1]
                with wiki.connect() as db:
                    p = wiki.get(db, pid)
                    p['history'] = [dict(r) for r in db.execute('SELECT version,note,created,snapshot FROM versions WHERE page_id=? ORDER BY version DESC', (pid,))]
                    p['attachments'] = [dict(r) for r in db.execute('SELECT id,name,length(data) AS size,created FROM attachments WHERE page_id=? ORDER BY created', (pid,))]
                    self.send(p)
            elif path.startswith('/api/attachment/'):
                with wiki.connect() as db:
                    a = db.execute('SELECT * FROM attachments WHERE id=?', (path.split('/')[-1],)).fetchone()
                    if not a:
                        raise Problem('Attachment not found.', 404)
                    self.send(a['data'], ctype='application/octet-stream', filename=a['name'])
            elif path == '/api/backup':
                self.send(wiki.backup(), ctype='application/octet-stream', filename='worklog-backup-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.sqlite3')
            elif path == '/api/export':
                self.send(wiki.export(), ctype='application/zip', filename='worklog-markdown.zip')
            elif path in ('/', '/index.html', '/app.js', '/styles.css'):
                file = ROOT/'static'/('index.html' if path=='/' else path[1:])
                types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'}
                self.send(file.read_bytes(), ctype=types[file.suffix]+'; charset=utf-8')
            else:
                raise Problem('Not found.', 404)
        except Problem as e:
            self.send({'error':str(e)}, e.status)
        except (OSError, sqlite3.Error):
            self.send({'error':'Could not read local storage. Check the server folder permissions.'}, 500)
    def do_POST(self):
        try:
            path = urlsplit(self.path).path
            self.guard(write=True, login=path in ('/api/login', '/api/setup'))
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                raise Problem('JSON required.', 415)
            try:
                n = int(self.headers.get('Content-Length', 0))
            except ValueError:
                raise Problem('Invalid content length.')
            if n < 2 or n > (8192 if path in ('/api/login','/api/setup') else 22_000_000):
                raise Problem('Request too large or empty.', 413)
            data = json.loads(self.rfile.read(n))
            if not isinstance(data, dict):
                raise Problem('JSON object required.')
            if path == '/api/setup':
                self.setup_account(data)
                return
            if path == '/api/login':
                self.login(data)
                return
            if path == '/api/logout':
                with self.server.auth_lock:
                    self.server.sessions.pop(self.session_id(), None)
                self.send({'ok':True}, cookie=f'{self.server.cookie_name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
                return
            wiki = self.server.wiki
            with wiki.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                if path == '/api/issue/save':
                    result = wiki.save_issue(db,data)
                elif path == '/api/issue/trash':
                    issue = wiki.get_issue(db,data.get('id'))
                    if issue['version'] != data.get('version'):
                        raise Problem('This issue changed. Reload and try again.',409)
                    issue.update(deleted=1-issue['deleted'], version=issue['version']+1, updated=now())
                    db.execute('UPDATE issues SET deleted=:deleted,version=:version,updated=:updated WHERE id=:id',issue)
                    wiki.issue_history(db,issue,'Moved to trash' if issue['deleted'] else 'Restored from trash')
                    result = issue
                elif path == '/api/save':
                    result = wiki.save(db, data, new=not bool(data.get('id')))
                elif path == '/api/space':
                    name = data.get('name', '')
                    desc = data.get('description', '')
                    if not isinstance(name,str) or not name.strip() or len(name)>80 or not isinstance(desc,str) or len(desc)>300:
                        raise Problem('Space name required (max 80 characters).')
                    result = {'id':uuid.uuid4().hex, 'name':name.strip(), 'description':desc}
                    db.execute('INSERT INTO spaces VALUES (:id,:name,:description)', result)
                elif path in ('/api/favorite', '/api/trash', '/api/restore'):
                    p = wiki.get(db, data.get('id'))
                    if data.get('version') != p['version']:
                        raise Problem('Page changed. Reload and try again.', 409)
                    if path == '/api/favorite':
                        p['favorite'] = 1-p['favorite']
                        db.execute('UPDATE pages SET favorite=? WHERE id=?', (p['favorite'],p['id']))
                    elif path == '/api/trash':
                        deleting = 1-p['deleted']
                        if deleting and db.execute('SELECT 1 FROM pages WHERE parent_id=? AND deleted=0', (p['id'],)).fetchone():
                            raise Problem('Move or trash the child pages first.')
                        if not deleting and p['parent_id'] and wiki.get(db,p['parent_id'])['deleted']:
                            p['parent_id']=None
                        p.update(deleted=deleting, version=p['version']+1, updated=now())
                        db.execute('UPDATE pages SET deleted=?,parent_id=?,version=?,updated=? WHERE id=?', (p['deleted'],p['parent_id'],p['version'],p['updated'],p['id']))
                        wiki.history(db,p,'Moved to trash' if deleting else 'Restored from trash')
                    else:
                        if p['deleted']:
                            raise Problem('Restore the page from trash first.')
                        old = db.execute('SELECT snapshot FROM versions WHERE page_id=? AND version=?',(p['id'],data.get('restore_version'))).fetchone()
                        if not old:
                            raise Problem('Version not found.',404)
                        snapshot = json.loads(old['snapshot'])
                        # Restore document content; keep current location to avoid reviving invalid ancestors.
                        p.update({k:snapshot[k] for k in ('title','body','status','labels')})
                        p = wiki.save(db,p,note='Restored content from v'+str(data['restore_version']))
                    result=p
                elif path == '/api/attachment':
                    p=wiki.get(db,data.get('page_id'))
                    if p['deleted']:
                        raise Problem('Restore page before attaching a file.')
                    name=data.get('name','')
                    if not isinstance(name,str) or not name or len(name)>200 or name in ('.','..') or re.search(r'[\\/\x00-\x1f\x7f]',name):
                        raise Problem('Invalid filename.')
                    raw=base64.b64decode(data.get('data',''),validate=True)
                    if len(raw)>15*1024*1024:
                        raise Problem('Attachment limit: 15 MB.',413)
                    result={'id':uuid.uuid4().hex,'name':name}
                    db.execute('INSERT INTO attachments VALUES (?,?,?,?,?)',(result['id'],p['id'],name,raw,now()))
                else:
                    raise Problem('Not found.',404)
            self.send(result)
        except Problem as e:
            self.send({'error':str(e)},e.status)
        except (json.JSONDecodeError, UnicodeError, ValueError, TypeError, binascii.Error):
            self.send({'error':'Invalid request data.'},400)
        except sqlite3.IntegrityError:
            self.send({'error':'Invalid or duplicate record.'},409)
        except (sqlite3.Error, OSError):
            self.send({'error':'Save failed. Check disk space and folder permissions. Your editor text is still available.'},500)

class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self, port, wiki, credentials=None):
        self.wiki=wiki
        self.token=secrets.token_urlsafe(32)
        self.credentials=credentials if credentials is not None else load_auth(wiki.path.parent)
        self.auth_lock=threading.Lock()
        self.sessions={}
        self.failures=[]
        self.blocked_until=0
        super().__init__(('127.0.0.1',port),Handler)
        self.cookie_name='worklog_session_'+str(self.server_address[1])

def restore_file(source, target):
    source,target=Path(source).resolve(),Path(target).resolve()
    if source==target or not source.is_file():
        raise ValueError('Choose an existing backup file different from the live database.')
    # Use SQLite's backup API. Never run SQL from an imported file.
    with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
            raise ValueError('Backup integrity check failed.')
        if db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()!=('2',):
            raise ValueError('Unsupported backup version.')
        for table,columns in {'spaces':['id','name','description'],'pages':['id','space_id','parent_id','title','body','status','labels','version','updated','favorite','deleted'],'versions':['page_id','version','snapshot','note','created'],'attachments':['id','page_id','name','data','created'],'issues':['id','space_id','title','description','kind','status','priority','assignee','due_date','labels','linked_page_id','version','created','updated','deleted'],'issue_versions':['issue_id','version','snapshot','note','created']}.items():
            if [r[1] for r in db.execute('PRAGMA table_info('+table+')')]!=columns:
                raise ValueError('Unsupported backup schema.')
        if db.execute('PRAGMA foreign_key_check').fetchone():
            raise ValueError('Backup contains broken references.')
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():
            before=target.with_name('before-restore-'+uuid.uuid4().hex[:8]+'.sqlite3')
            with closing(sqlite3.connect(target)) as old, closing(sqlite3.connect(before)) as copy:
                old.backup(copy)
            print('Previous database saved as:',before)
        with closing(sqlite3.connect(target)) as out:
            db.backup(out)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8766)
    parser.add_argument('--data-dir',type=Path,default=ROOT/'data')
    parser.add_argument('--restore',type=Path,help='Stop the server first. Restore a trusted SQLite backup and exit.')
    parser.add_argument('--set-password',action='store_true',help='Stop the server first. Set a new local password using hidden input.')
    parser.add_argument('--username',default='admin',help='Username for --set-password.')
    args=parser.parse_args()
    if args.set_password:
        password=getpass.getpass('New password (8+ characters): ')
        confirmation=getpass.getpass('Confirm password: ')
        if password != confirmation:
            raise SystemExit('Passwords do not match. No changes made.')
        save_auth(args.data_dir/'auth.json', password_record(args.username,password))
        print('Login updated. Restart the server.'); raise SystemExit(0)
    if args.restore:
        restore_file(args.restore,args.data_dir/'worklog.sqlite3')
        print('Restore complete. Start the server normally.'); raise SystemExit(0)
    server=Server(args.port,Wiki(args.data_dir/'worklog.sqlite3'))
    print(f'Worklog Lite: http://127.0.0.1:{server.server_address[1]}',flush=True)
    print('Local access only. Keep this window open. Ctrl+C to stop.',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
