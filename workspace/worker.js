let py;
const sources=['https://cdn.jsdelivr.net/pyodide/v314.0.7/full/','https://unpkg.com/pyodide@314.0.7/'];
const source=Number(new URL(self.location.href).searchParams.get('source'))||0;
try {
  self.postMessage({type:'progress',message:'Loading Python / SQLite… ('+(source+1)+'/2)'});
  const base=sources[source]||sources[0];
  const {loadPyodide}=await import(base+'pyodide.mjs');
  py=await loadPyodide({indexURL:base});
  const response=await fetch('./runner.py?v=sql31-v1');
  if(!response.ok)throw new Error('Could not load test runner: '+response.status);
  py.runPython(await response.text());
  self.postMessage({type:'ready',version:py.runPython('sys.version.split()[0]')});
} catch(e) {self.postMessage({type:'error',error:String(e.message||e)});}
self.onmessage=async({data})=>{
  try{
    if(!py)throw new Error('Runtime is not ready.');
    py.globals.set('request_json',JSON.stringify(data));
    const result=py.runPython('json.dumps(evaluate(json.loads(request_json)))');
    self.postMessage({type:'result',data:JSON.parse(result)});
  }catch(e){self.postMessage({type:'error',error:String(e.message||e)});}
};
