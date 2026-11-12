let runtime;

async function loadRuntime() {
  const sources = [
    'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/',
    'https://unpkg.com/pyodide@314.0.7/'
  ];
  let py;
  for (const base of sources) {
    try {
      const {loadPyodide} = await import(base + 'pyodide.mjs');
      py = await loadPyodide({indexURL: base});
      break;
    } catch {
      // Use the same fallback CDN as the workspace runner.
    }
  }
  if (!py) throw new Error('Could not load the execution engine. Check your connection and submit again.');
  const [runner, grammar, adapter] = await Promise.all([
    fetch('../runner.py?v=english-v1'),
    fetch('../vendor/sqlglot-28.0.0-py3-none-any.whl'),
    fetch('mysql_adapter.py?v=english-v1')
  ]);
  if (![runner, grammar, adapter].every(response => response.ok)) throw new Error('Could not load grading files.');
  py.unpackArchive(new Uint8Array(await grammar.arrayBuffer()), 'zip', {extractDir: '/home/pyodide/sqlglot_vendor'});
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide/sqlglot_vendor')");
  py.runPython(await runner.text());
  py.runPython(await adapter.text());
  return py;
}

self.onmessage = async ({data}) => {
  try {
    runtime ??= loadRuntime();
    const py = await runtime;
    py.globals.set('tutor_request', JSON.stringify(data));
    const result = py.runPython('json.dumps(evaluate_tutor(json.loads(tutor_request)))');
    self.postMessage({result: JSON.parse(result)});
  } catch (error) {
    runtime = null;
    self.postMessage({error: String(error.message || error)});
  }
};

