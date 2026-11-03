"""Local-only Ollama/PDF companion. Python 3.10+, standard library only.
Run: python companion.py, then open http://127.0.0.1:8765/.
No cloud service, arbitrary URL proxy, API key or pip installation is required.
"""
import json, os, re, threading, urllib.request, urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parent
ALLOWED_ORIGINS={'https://swk99.github.io','http://127.0.0.1:8765','http://localhost:8765'}
ALLOWED_HOSTS={'127.0.0.1:8765','localhost:8765'}
PAPERS={p['id'] for p in json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))}
OLLAMA='http://127.0.0.1:11434'
MODEL_LOCK=threading.Lock()
MAX_BODY=200_000
MAX_PDF=40*1024*1024

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,*args): pass  # Do not log user questions or documents.
    def allowed(self):
        return self.headers.get('Host','') in ALLOWED_HOSTS and self.headers.get('Origin') in (None,*ALLOWED_ORIGINS)
    def end_headers(self):
        origin=self.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
            self.send_header('Access-Control-Allow-Private-Network','true')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()
    def json_response(self,data,status=200):
        data=json.dumps(data).encode(); self.send_response(status)
        self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
    def do_OPTIONS(self):
        if not self.allowed(): return self.json_response({'error':'Origin or Host not allowed'},403)
        self.send_response(204);self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
    def do_GET(self):
        if not self.allowed():return self.json_response({'error':'Origin or Host not allowed'},403)
        try:
            if self.path=='/v1/models':
                with urllib.request.urlopen(OLLAMA+'/api/tags',timeout=10) as r: data=json.load(r)
                return self.json_response({'object':'list','data':[{'id':m['name'],'object':'model'} for m in data.get('models',[])]})
            if self.path.startswith('/papers/'):
                match=re.fullmatch(r'/papers/(\d{4}\.\d{4,5})\.pdf',self.path)
                if not match or match[1] not in PAPERS:return self.json_response({'error':'Unknown paper'},404)
                request=urllib.request.Request('https://arxiv.org/pdf/'+match[1],headers={'User-Agent':'AI-Paper-Studio/1.0 (personal research reader)'})
                with urllib.request.urlopen(request,timeout=90) as r:
                    data=r.read(MAX_PDF+1)
                if len(data)>MAX_PDF:return self.json_response({'error':'PDF exceeds 40 MB'},413)
                if b'%PDF' not in data[:1024]:return self.json_response({'error':'Source did not return PDF'},502)
                self.send_response(200);self.send_header('Content-Type','application/pdf');self.send_header('Content-Length',str(len(data)))
                self.end_headers();self.wfile.write(data);return
            if self.path.startswith('/v1/'):return self.json_response({'error':'Unknown endpoint'},404)
            # Do not expose Python source, dotfiles, directory listings or arbitrary paths.
            path=self.path.split('?',1)[0]
            if path not in {'/','/index.html','/style.css','/app.mjs','/core.mjs','/catalog.json','/vendor/pdf.min.mjs','/vendor/pdf.worker.min.mjs'}:
                return self.json_response({'error':'Not found'},404)
            return super().do_GET()
        except (urllib.error.URLError,TimeoutError,OSError) as e:
            self.json_response({'error':{'message':'Source unavailable. Ensure Ollama is running, or retry the arXiv download. '+str(e)[:150]}},502)
    def do_POST(self):
        if not self.allowed():return self.json_response({'error':'Origin or Host not allowed'},403)
        if self.path!='/v1/chat/completions':return self.json_response({'error':'Not found'},404)
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.json_response({'error':'JSON required'},415)
        try: size=int(self.headers.get('Content-Length','0'))
        except ValueError:return self.json_response({'error':'Invalid size'},400)
        if not 0<size<=MAX_BODY:return self.json_response({'error':'Request too large or empty'},413)
        try:
            body=json.loads(self.rfile.read(size));model=body.get('model');messages=body.get('messages')
            if not isinstance(model,str) or not model or not isinstance(messages,list) or len(messages)>30:raise ValueError('Invalid model or messages')
            for m in messages:
                if not isinstance(m,dict) or m.get('role') not in {'system','user','assistant'} or not isinstance(m.get('content'),str):raise ValueError('Invalid message')
            if not MODEL_LOCK.acquire(blocking=False):return self.json_response({'error':{'message':'A model request is already running. Wait and retry.'}},429)
            try:
                payload=json.dumps({'model':model,'messages':messages,'stream':False,'think':False,'options':{'temperature':0.2,'num_ctx':16384,'num_predict':2200}}).encode()
                req=urllib.request.Request(OLLAMA+'/api/chat',data=payload,headers={'Content-Type':'application/json'})
                with urllib.request.urlopen(req,timeout=240) as r:reply=json.load(r)
                self.json_response({'choices':[{'message':{'role':'assistant','content':reply.get('message',{}).get('content','')}}]})
            finally:MODEL_LOCK.release()
        except (ValueError,TypeError) as e:self.json_response({'error':{'message':str(e)}},400)
        except (urllib.error.URLError,TimeoutError,OSError) as e:self.json_response({'error':{'message':'Ollama request failed: '+str(e)[:150]}},502)

if __name__=='__main__':
    server=ThreadingHTTPServer(('127.0.0.1',8765),Handler)
    print('AI Paper Studio: http://127.0.0.1:8765/\nKeep this window open. Ctrl+C to stop.\nOllama must be running on 127.0.0.1:11434.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:server.server_close()
