(() => {
  const articles = [...document.querySelectorAll('.lesson')];
  const links = [...document.querySelectorAll('[data-lesson]')];
  const overview = document.getElementById('overview');
  const sidebar = document.querySelector('aside');
  let completed = new Set();
  try {const saved = JSON.parse(localStorage.getItem('oop-atlas-progress-v1') || '[]'); if(Array.isArray(saved)) completed = new Set(saved.filter(id => articles.some(a=>a.id===id)));} catch {}
  function sync() {
    document.getElementById('progress-text').textContent = `${completed.size} / ${articles.length}개 학습 완료`;
    document.querySelector('progress').value = completed.size;
    document.querySelectorAll('.done').forEach(b => {const done=completed.has(b.dataset.id);b.setAttribute('aria-pressed',String(done));b.textContent=done?'✓ 학습 완료 · 다시 표시 해제':'이해했어요 · 학습 완료';});
    links.forEach(a => {const mark=a.querySelector('.check');if(mark)mark.textContent=completed.has(a.dataset.lesson)?'✓ ':'';});
  }
  function route() {
    let id; try{id=decodeURIComponent(location.hash.slice(1));}catch{id='';}
    const selected=articles.find(a=>a.id===id);
    overview.hidden=Boolean(selected);
    articles.forEach(a=>a.hidden=a!==selected);
    links.forEach(a=>{a.classList.toggle('active',a.dataset.lesson===selected?.id);if(a.dataset.lesson===selected?.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=selected?`${selected.dataset.title} · OOP 도감`:'OOP 도감 · 그림으로 배우는 객체지향';
    sidebar.classList.remove('open');document.getElementById('menu').setAttribute('aria-expanded','false');
    if(selected){const link=links.find(a=>a.dataset.lesson===id);if(link)link.closest('details').open=true;}
    window.scrollTo({top:0,behavior:'instant'});
    if(location.hash){const heading=(selected||overview).querySelector('h1');heading.focus({preventScroll:true});}
  }
  document.getElementById('search').addEventListener('input',e=>{
    const query=e.target.value.trim().toLowerCase();let count=0;
    document.querySelectorAll('aside details').forEach(group=>{
      let matches=0;group.querySelectorAll('[data-lesson]').forEach(a=>{const article=document.getElementById(a.dataset.lesson);const show=!query||article.textContent.toLowerCase().includes(query);a.hidden=!show;if(show)matches++;});
      group.hidden=matches===0;if(query&&matches)group.open=true;count+=matches;
    });
    document.getElementById('search-result').textContent=query?`${count}개 항목 검색됨`:'';
  });
  document.getElementById('menu').addEventListener('click',e=>{const open=sidebar.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('.done').forEach(b=>b.addEventListener('click',()=>{completed.has(b.dataset.id)?completed.delete(b.dataset.id):completed.add(b.dataset.id);try{localStorage.setItem('oop-atlas-progress-v1',JSON.stringify([...completed]));}catch{document.getElementById('save-status').textContent='이 브라우저에서 저장이 제한되어 현재 탭에서만 표시돼요.';}sync();}));
  document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{const code=b.closest('section').querySelector('code');try{await navigator.clipboard.writeText(code.textContent);b.textContent='복사했어요';}catch{const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);b.textContent='코드 선택됨 · 직접 복사하세요';}}));
  window.addEventListener('hashchange',route);sync();route();
})();
