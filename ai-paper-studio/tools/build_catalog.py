"""Build a source-verified 100-paper catalogue; no full PDFs are redistributed."""
import json, time, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
rows = [line.split('|') for line in (ROOT/'tools/seed.tsv').read_text().splitlines()]
url = 'https://export.arxiv.org/api/query?id_list=' + ','.join(r[0] for r in rows) + '&max_results=100'
req = urllib.request.Request(url, headers={'User-Agent':'AI-Paper-Studio/1.0 (educational catalogue)'})
with urllib.request.urlopen(req, timeout=120) as response:
    tree = ET.fromstring(response.read())
ns={'a':'http://www.w3.org/2005/Atom'}
entries={e.findtext('a:id', namespaces=ns).split('/abs/')[-1].split('v')[0]:e for e in tree.findall('a:entry',ns)}
papers=[]
for aid, short, category, note in rows:
    if aid not in entries: raise ValueError('Missing source '+aid)
    e=entries[aid]
    title=' '.join(e.findtext('a:title',namespaces=ns).split())
    abstract=' '.join(e.findtext('a:summary',namespaces=ns).split())
    papers.append(dict(id=aid,title=title,short=short,category=category,note=note,
        year=int(e.findtext('a:published',namespaces=ns)[:4]),
        authors=[a.findtext('a:name',namespaces=ns) for a in e.findall('a:author',ns)],
        url='https://arxiv.org/abs/'+aid,pdf='https://arxiv.org/pdf/'+aid,
        # Catalogue summaries are original study notes. Metadata is verified against arXiv.
        verified=True))
(ROOT/'catalog.json').write_text(json.dumps(papers,ensure_ascii=False,indent=2)+'\n')
print('Verified',len(papers),'records')
for p in papers: print(p['id'],p['title'])
