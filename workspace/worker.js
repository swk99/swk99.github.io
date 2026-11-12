let py;
let grammarReady=false;
const sources=['https://cdn.jsdelivr.net/pyodide/v314.0.7/full/','https://unpkg.com/pyodide@314.0.7/'];
const source=Number(new URL(self.location.href).searchParams.get('source'))||0;
try {
  self.postMessage({type:'progress',message:'Loading Python / SQLite… ('+(source+1)+'/2)'});
  const base=sources[source]||sources[0];
  const {loadPyodide}=await import(base+'pyodide.mjs');
  py=await loadPyodide({indexURL:base});
  const response=await fetch('./runner.py?v=english-v1');
  if(!response.ok)throw new Error('Could not load test runner: '+response.status);
  py.runPython(await response.text());
  self.postMessage({type:'ready',version:py.runPython('sys.version.split()[0]')});
} catch(e) {self.postMessage({type:'error',error:String(e.message||e)});}
self.onmessage=async({data})=>{
  if(data.type==='plan'){
    try{
      py.globals.set('request_json',JSON.stringify(data));
      const rows=JSON.parse(py.runPython('json.dumps(preview_sql_plan(json.loads(request_json)))'));
      self.postMessage({type:'plan',revision:data.revision,rows});
    }catch(e){
      const error=String(e.message||e).trim().split('\n').at(-1).replace(/^(?:sqlite3\.\w+|ValueError): /,'');
      self.postMessage({type:'plan',revision:data.revision,error});
    }
    return;
  }
  try{
    if(!py)throw new Error('Runtime is not ready.');
    if(data.requirements&&!grammarReady){
      self.postMessage({type:'progress',message:'Preparing the learning syntax checker…'});
      const grammar=await fetch('./vendor/sqlglot-28.0.0-py3-none-any.whl');
      if(!grammar.ok)throw new Error('Could not load the syntax checker. Please run again.');
      py.unpackArchive(new Uint8Array(await grammar.arrayBuffer()),'zip',{extractDir:'/home/pyodide/sqlglot_vendor'});
      py.runPython("import sys; sys.path.insert(0, '/home/pyodide/sqlglot_vendor')");
      grammarReady=true;
    }
    py.globals.set('request_json',JSON.stringify(data));
    const result=py.runPython('json.dumps(evaluate(json.loads(request_json)))');
    self.postMessage({type:'result',data:JSON.parse(result)});
  }catch(e){self.postMessage({type:'error',error:String(e.message||e)});}
};

