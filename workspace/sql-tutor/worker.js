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
  if (!py) throw new Error('실행 엔진을 불러오지 못했습니다. 연결을 확인하고 다시 제출하세요.');
  const [runner, grammar, adapter] = await Promise.all([
    fetch('../runner.py'),
    fetch('../vendor/sqlglot-28.0.0-py3-none-any.whl'),
    fetch('mysql_adapter.py')
  ]);
  if (![runner, grammar, adapter].every(response => response.ok)) throw new Error('채점 파일을 불러오지 못했습니다.');
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
