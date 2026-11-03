import importlib.util, json, threading, unittest, urllib.request, urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
spec=importlib.util.spec_from_file_location('companion',Path(__file__).resolve().parents[1]/'companion.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class MockOllama(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):
        self.send_response(200);self.end_headers();self.wfile.write(b'{"models":[{"name":"test-model"}]}')
    def do_POST(self):
        d=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        assert d['options']['num_ctx']==16384
        assert d['stream'] is False
        self.send_response(200);self.end_headers();self.wfile.write(json.dumps({'message':{'content':'Mock answer [S1]'}}).encode())
class CompanionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fake=ThreadingHTTPServer(('127.0.0.1',0),MockOllama)
        c.OLLAMA='http://127.0.0.1:'+str(cls.fake.server_port)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),c.Handler)
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
        c.ALLOWED_HOSTS.add('127.0.0.1:'+str(cls.server.server_port))
        for s in (cls.fake,cls.server):threading.Thread(target=s.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        for s in (cls.fake,cls.server):s.shutdown();s.server_close()
    def request(self,path,origin='https://swk99.github.io',data=None,method=None,headers=None):
        h={'Origin':origin,**(headers or {})}
        if data is not None:h['Content-Type']='application/json';data=json.dumps(data).encode()
        r=urllib.request.Request(self.base+path,data=data,headers=h,method=method)
        try:return urllib.request.urlopen(r,timeout=5)
        except urllib.error.HTTPError as e:return e
    def test_models(self):
        r=self.request('/v1/models');self.assertEqual(r.status,200);self.assertEqual(json.load(r)['data'][0]['id'],'test-model')
        self.assertEqual(r.headers['Access-Control-Allow-Origin'],'https://swk99.github.io')
    def test_generation_contract(self):
        r=self.request('/v1/chat/completions',data={'model':'test-model','messages':[{'role':'user','content':'test'}]})
        self.assertEqual(r.status,200);self.assertEqual(json.load(r)['choices'][0]['message']['content'],'Mock answer [S1]')
    def test_disallowed_origin(self):self.assertEqual(self.request('/v1/models',origin='https://attacker.invalid').status,403)
    def test_disallowed_host(self):self.assertEqual(self.request('/v1/models',headers={'Host':'attacker.invalid'}).status,403)
    def test_no_arbitrary_proxy(self):self.assertEqual(self.request('/papers/9999.99999.pdf').status,404)
    def test_no_source_or_traversal(self):
        for p in ['/companion.py','/../index.html','/.git/config','/vendor/']:self.assertEqual(self.request(p).status,404)
    def test_oversize(self):self.assertEqual(self.request('/v1/chat/completions',data={'x':'a'*200001}).status,413)
    def test_bad_message(self):self.assertEqual(self.request('/v1/chat/completions',data={'model':'m','messages':[{'role':'tool','content':'x'}]}).status,400)
    def test_preflight(self):self.assertEqual(self.request('/v1/models',method='OPTIONS').status,204)
if __name__=='__main__':unittest.main()
