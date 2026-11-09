/* Mobile presentation adapter. Existing editor, judge and storage stay authoritative. */
(() => {
  const small = matchMedia('(max-width:760px)');
  const make = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const nav = make('nav', '', 'pocket-nav');
  nav.setAttribute('aria-label', 'SQL 화면');
  const views = {list:'☰ 목록', problem:'문제', code:'⌨ 코딩', result:'결과'};
  function show(view) {
    document.body.dataset.pocketView = view;
    for (const b of nav.children) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    if (view === 'result') document.body.classList.add('sql-results-open');
    requestAnimationFrame(() => aceEditor?.resize());
  }
  for (const [view, label] of Object.entries(views)) {
    const b = make('button', label); b.type = 'button'; b.dataset.view = view;
    b.onclick = () => show(view); nav.append(b);
  }
  document.body.append(nav); show('problem');
  const keys = make('div', '', 'pocket-keys'); keys.setAttribute('aria-label', 'SQL 빠른 입력');
  function insert(text) {
    if (aceEditor) { aceEditor.insert(text); aceEditor.focus(); }
    else { const c = document.getElementById('code'); c.setRangeText(text,c.selectionStart,c.selectionEnd,'end'); c.dispatchEvent(new Event('input',{bubbles:true})); c.focus(); }
  }
  for (const [label, text] of [['SELECT','SELECT '],['FROM','\nFROM '],['WHERE','\nWHERE '],['JOIN','\nJOIN '],['ON',' ON '],['GROUP BY','\nGROUP BY '],['ORDER BY','\nORDER BY '],['WITH','WITH '],['AS',' AS '],['↵','\n'],['⇥','  '],['(', '('],[')',')'],[',',', '],['*','*'],['=','= '],["'","'"]]) {
    const b = make('button', label); b.type='button'; b.onpointerdown=e=>e.preventDefault(); b.onclick=()=>insert(text); keys.append(b);
  }
  const hide = make('button','키보드 닫기'); hide.onclick=()=>{document.activeElement?.blur();aceEditor?.blur();}; keys.append(hide);
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
  const viewport=()=>{const v=visualViewport;document.documentElement.style.setProperty('--pocket-height',(v?.height||innerHeight)+'px');document.documentElement.style.setProperty('--pocket-top',(v?.offsetTop||0)+'px');aceEditor?.resize();};
  visualViewport?.addEventListener('resize',viewport);visualViewport?.addEventListener('scroll',viewport);viewport();
  const install=make('button','홈 화면에 추가하기','pocket-install');
  install.onclick=()=>alert('Safari에서 공유 버튼 → 홈 화면에 추가를 선택하세요.\n첫 실행과 SQL 엔진 로딩에는 인터넷이 필요합니다. 풀이 기록은 이 기기에 저장됩니다.');
  document.querySelector('header').append(install);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
