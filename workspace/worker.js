import {loadPyodide} from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
let py;
try {
  py=await loadPyodide();
  const response=await fetch('./runner.py');
  if(!response.ok) throw new Error('Could not load runner');
  py.runPython(await response.text());
  self.postMessage({type:'ready',version:py.runPython('sys.version.split()[0]')});
} catch(e) {self.postMessage({type:'error',error:'Python could not load. Check your connection or CDN access. '+e.message});}
self.onmessage=async ({data})=>{
  try {
    py.globals.set('request_json',JSON.stringify(data));
    const result=py.runPython('json.dumps(evaluate(json.loads(request_json)))');
    self.postMessage({type:'result',data:JSON.parse(result)});
  } catch(e){self.postMessage({type:'error',error:e.message});}
};
