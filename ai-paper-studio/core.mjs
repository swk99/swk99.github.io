// Dependency-free retrieval. BM25 is lexical, with explicit bilingual query expansion.
const STOP = new Set(
  "a an the to of for and or is are was were in on it this that how what why with from do does explain paper me using use as by be its simple example mean means beginner explain compare difference selected main idea give define technical terms".split(
    " ",
  ),
);
const ALIASES = {
  어텐션: "attention self attention query key value",
  트랜스포머: "transformer attention",
  로라: "lora low rank adaptation",
  큐로라: "qlora quantization",
  강화학습: "reinforcement learning policy reward",
  "강화 학습": "reinforcement learning policy reward",
  보상: "reward",
  클리핑: "clipping ppo",
  클립: "clipping ppo",
  확산: "diffusion denoising",
  검색: "retrieval rag",
  그래프: "graph",
  미세조정: "fine tuning adaptation",
  파인튜닝: "fine tuning adaptation",
  양자화: "quantization qlora",
  추론: "reasoning inference",
  차이: "compare difference",
  요약: "summary",
  자기지도: "self supervised",
  쿼리: "query attention",
  키: "key attention",
  밸류: "value attention",
  위치: "positional position",
  메모리: "memory",
  랭크: "rank lora",
  지도학습: "supervised learning",
  임베딩: "embedding representations",
  환각: "hallucination grounding",
  정책: "policy",
  그래디언트: "gradient",
  어드밴티지: "advantage",
  어댑터: "adapter",
  문맥: "context",
  bert: "bert masked bidirectional",
  ppo: "ppo proximal policy optimization clipping",
  lora: "lora low rank adaptation",
  "q k v": "query key value attention",
};
export function expandQuery(s) {
  let t = s.toLowerCase();
  if (/q[\s,]+k[\s,]+(?:and\s+)?v/.test(t)) s += " query key value attention";
  for (const [k, v] of Object.entries(ALIASES)) if (t.includes(k)) s += " " + v;
  return s;
}
export function tokens(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]+/gu) || []
  ).filter((t) => t.length > 1 && !STOP.has(t));
}
export function chunkPages(pages, meta, size = 1400, overlap = 180) {
  const out = [];
  for (const p of pages) {
    const text = p.text.replace(/\s+/g, " ").trim();
    for (let start = 0; start < text.length; start += size - overlap) {
      const end = Math.min(start + size, text.length);
      out.push({
        ...meta,
        page: p.page,
        text: text.slice(start, end),
        kind: "full text",
        chunk: out.length,
      });
      if (end === text.length) break;
    }
  }
  return out;
}
export function makeIndex(chunks) {
  const df = new Map();
  let total = 0;
  const docs = chunks.map((c) => {
    const ts = tokens(`${c.title} ${c.short || ""} ${c.text}`),
      tf = new Map();
    total += ts.length;
    for (const t of ts) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { c, tf, len: ts.length };
  });
  return { docs, df, avg: total / (docs.length || 1) };
}
export function retrieve(index, query, { limit = 8, selected = null } = {}) {
  const terms = [...new Set(tokens(expandQuery(query)))],
    N = index.docs.length;
  return index.docs
    .map(({ c, tf, len }) => {
      let score = 0;
      for (const term of terms) {
        const f = tf.get(term) || 0;
        if (!f) continue;
        const idf = Math.log(
          1 +
            (N - (index.df.get(term) || 0) + 0.5) /
              ((index.df.get(term) || 0) + 0.5),
        );
        score +=
          (idf * f * 2.2) /
          (f + 1.2 * (0.25 + (0.75 * len) / (index.avg || 1)));
      }
      if (score && c.paperId === selected) score *= 1.25;
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(
      (c, i, all) =>
        all.slice(0, i).filter((x) => x.paperId === c.paperId).length < 3,
    )
    .slice(0, limit);
}
export function summaryBatches(pages, max = 13000) {
  const groups = [];
  let text = "";
  for (const p of pages) {
    let labelled =
      p.page === null ? p.text + "\n" : `\n[Page ${p.page}]\n${p.text}\n`;
    while (labelled.length) {
      const room = max - text.length;
      text += labelled.slice(0, room);
      labelled = labelled.slice(room);
      if (text.length >= max) {
        groups.push(text);
        text =
          labelled && p.page !== null ? `\n[Page ${p.page}, continued]\n` : "";
      }
    }
  }
  if (text.trim()) groups.push(text);
  return groups;
}
export function extractOverview(pages) {
  const text = pages
    .slice(0, 2)
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ");
  const m = /\babstract\b\s*[:—-]?\s*/i.exec(text);
  if (m) {
    const rest = text.slice(m.index + m[0].length);
    return rest
      .split(/\b(?:1\s*[.\s]?\s*)?introduction\b/i)[0]
      .slice(0, 1800)
      .trim();
  }
  return text.slice(0, 1800).trim();
}
export function safeEndpoint(raw) {
  const u = new URL(raw);
  if (u.username || u.password || u.search || u.hash)
    throw new Error("Use a base URL without credentials, query or fragment.");
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    )
  )
    throw new Error("Use HTTPS, or HTTP on localhost only.");
  return u.href.replace(/\/$/, "");
}
export function citationAudit(text, count) {
  const ids = [...text.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1]));
  return {
    missing: count > 0 && ids.length === 0,
    invalid: ids.some((id) => id < 1 || id > count),
  };
}
