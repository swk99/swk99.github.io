/* Mobile presentation adapter. Existing editor, judge and storage stay authoritative. */
(() => {
  const small = matchMedia('(max-width:760px)');
  const make = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const nav = make('nav', '', 'pocket-nav');
  nav.setAttribute('aria-label', 'SQL view');
  const views = {list:'☰ List', problem:'Problem', code:'⌨ Code', result:'Result'};
  function show(view) {
    document.body.dataset.pocketView = view;
    for (const b of nav.children) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    if (view === 'result') document.body.classList.add('sql-results-open');
    requestAnimationFrame(() => { aceEditor?.resize(); viewport(); });
  }
  for (const [view, label] of Object.entries(views)) {
    const b = make('button', label); b.type = 'button'; b.dataset.view = view;
    b.onclick = () => show(view); nav.append(b);
  }
  document.body.append(nav); show('problem');
  const keys = make('div', '', 'pocket-keys'); keys.setAttribute('aria-label', 'SQL quick input');
  function insert(text) {
    if (aceEditor) { aceEditor.insert(text); aceEditor.focus(); }
    else { const c = document.getElementById('code'); c.setRangeText(text,c.selectionStart,c.selectionEnd,'end'); c.dispatchEvent(new Event('input',{bubbles:true})); c.focus(); }
  }
  for (const [label, text] of [['SELECT','SELECT '],['FROM','\nFROM '],['WHERE','\nWHERE '],['JOIN','\nJOIN '],['ON',' ON '],['GROUP BY','\nGROUP BY '],['ORDER BY','\nORDER BY '],['WITH','WITH '],['AS',' AS '],['↵','\n'],['⇥','  '],['(', '('],[')',')'],[',',', '],['*','*'],['=','= '],["'","'"]]) {
    const b = make('button', label); b.type='button'; b.onpointerdown=e=>e.preventDefault(); b.onclick=()=>insert(text); keys.append(b);
  }
  function dismissKeyboard() {document.activeElement?.blur();aceEditor?.blur();viewport();}
  const hide = make('button','Dismiss keyboard'); hide.onclick=dismissKeyboard; keys.append(hide);
  const done = make('button','Done','pocket-done'); done.type='button';done.setAttribute('aria-label','Dismiss keyboard and show menu');done.onclick=dismissKeyboard;
  document.querySelector('.toolbar>div').append(done);
  document.querySelector('.editor-wrap').before(keys);
  let lastId, configuredEditor;
  function sync() {
    if (!small.matches || current?.language !== 'sql') return;
    if (lastId !== current.id) {lastId=current.id; show('problem');}
    if (aceEditor) {
      if (!document.getElementById('ace').classList.contains('ace-tomorrow-night')) aceEditor.setTheme('ace/theme/tomorrow_night');
      if (configuredEditor !== aceEditor) {aceEditor.session.setUseWrapMode(true);aceEditor.setOptions({fontSize:'16px',showGutter:false,tabSize:2,scrollPastEnd:0.25});configuredEditor=aceEditor;}
    }
  }
  new MutationObserver(sync).observe(document.getElementById('problem-title'),{childList:true});
  new MutationObserver(sync).observe(document.getElementById('ace'),{attributes:true,attributeFilter:['hidden']});
  for (const id of ['run','submit']) document.getElementById(id).addEventListener('click',()=>{if(small.matches&&current?.language==='sql'){document.activeElement?.blur();aceEditor?.blur();show('result');}});
  document.addEventListener('click',e=>{if(e.target.closest('.sql-reopen'))show('result');});
  small.addEventListener('change',()=>{if(!small.matches&&aceEditor&&current?.language==='sql'){aceEditor.setTheme('ace/theme/chrome');aceEditor.setOption('showGutter',true);configuredEditor=null;}sync();});
  let viewportFrame=0;
  function viewport() {
    cancelAnimationFrame(viewportFrame);
    viewportFrame=requestAnimationFrame(()=>{
      const v=window.visualViewport;
      const editing=small.matches&&current?.language==='sql'&&document.body.dataset.pocketView==='code'&&!!document.activeElement?.closest('.editor-wrap');
      document.body.classList.toggle('pocket-editing',editing);
      document.documentElement.style.setProperty('--pocket-height',Math.round(v?.height||innerHeight)+'px');
      document.documentElement.style.setProperty('--pocket-top',Math.round(v?.offsetTop||0)+'px');
      // Resize after focus-mode CSS has freed the header/nav space, then reveal the caret.
      aceEditor?.resize(true);
      if(editing&&aceEditor)aceEditor.renderer.scrollCursorIntoView(null,0.5);
    });
  }
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);
  window.addEventListener('resize',viewport);
  document.addEventListener('focusin',viewport);
  document.addEventListener('focusout',viewport);
  viewport();
  const install=make('button','Add to Home Screen','pocket-install');
  install.onclick=()=>alert('In Safari, tap Share → Add to Home Screen.\nInternet is required on first launch and to load the SQL engine. Solutions are saved on this device.');
  document.querySelector('header').append(install);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
})();

