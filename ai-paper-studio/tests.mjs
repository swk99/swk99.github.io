import assert from "node:assert/strict";
import fs from "node:fs";
import {
  chunkPages,
  makeIndex,
  retrieve,
  summaryBatches,
  safeEndpoint,
  citationAudit,
} from "./core.mjs";
const papers = JSON.parse(
  fs.readFileSync(new URL("./catalog.json", import.meta.url)),
);
assert.equal(papers.length, 100);
assert.equal(new Set(papers.map((p) => p.id)).size, 100);
assert(papers.every((p) => p.verified && p.title && p.note));
const ix = makeIndex(
  papers.map((p) => ({
    paperId: p.id,
    title: p.title,
    short: p.short,
    text: p.note,
  })),
);
for (const [query, id] of [
  ["self attention query key value", "1706.03762"],
  ["LoRA", "2106.09685"],
  ["PPO clipping", "1707.06347"],
  ["로라 저랭크", "2106.09685"],
  ["큐로라 양자화", "2305.14314"],
  ["강화학습 PPO 클리핑", "1707.06347"],
])
  assert(
    retrieve(ix, query, { limit: 4 }).some((s) => s.paperId === id),
    query,
  );
assert.equal(retrieve(ix, "zzzzzzzzunknown").length, 0);
const chunks = chunkPages(
  [
    { page: 1, text: "A".repeat(3000) },
    { page: 2, text: "B".repeat(10) },
  ],
  { paperId: "test" },
);
assert(chunks.filter((c) => c.page === 1).length > 1);
assert.equal(chunks.at(-1).page, 2);
assert(chunks.every((c) => c.text.length <= 1400));
const batch = summaryBatches(
  [
    { page: 1, text: "START " + "word ".repeat(9000) + " END" },
    { page: 2, text: "LASTPAGE" },
  ],
  1000,
);
assert(batch.length > 40);
assert(batch.join("").includes("START"));
assert(batch.join("").includes("END"));
assert(batch.join("").includes("LASTPAGE"));
assert(batch.every((b) => b.length <= 1000));
assert.throws(() => safeEndpoint("http://evil.test/v1"));
assert.throws(() => safeEndpoint("https://user:pass@example.com"));
assert.equal(
  safeEndpoint("http://127.0.0.1:8765/v1"),
  "http://127.0.0.1:8765/v1",
);
assert(citationAudit("claim [S99]", 2).invalid);
assert(citationAudit("no citation", 2).missing);
assert(!citationAudit("claim [S1]", 2).invalid);
// Source/title regression checks for initially ambiguous catalogue identifiers.
assert(papers.find((p) => p.short === "BitFit").title.includes("BitFit"));
assert(
  papers
    .find((p) => p.short === "Generalized Advantage Estimation")
    .title.includes("Advantage Estimation"),
);
assert(
  papers
    .find((p) => p.short === "Hindsight Experience Replay")
    .title.includes("Hindsight"),
);
console.log(
  "PASS: catalogue, bilingual retrieval, page boundaries, complete summary batching, endpoint and citation checks",
);
