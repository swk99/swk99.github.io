# AI Paper Studio

A research-learning chatbot and PDF reading room at **https://swk99.github.io/ai-paper-studio/**.

## Start here (한국어)

1. 페이지에서 **Connect AI**를 누르세요.
2. 무료 로컬 모델을 쓰려면 Ollama에서 모델을 준비하고, 이 저장소를 내려받아 `ai-paper-studio/start-windows.bat`를 실행하세요. Python 3.10+가 필요하며 추가 pip 설치는 없습니다.
3. 모델 이름을 입력하고 **Connect & test**를 누르세요. 기본 예시는 `qwen3.5:4b`이며 다른 Ollama 모델도 사용할 수 있습니다.
4. 논문을 선택하거나 새 PDF를 올린 뒤 **Summarise paper**, **Explain simply**, **Connect ideas**, **Quiz me**를 사용하세요.
5. **Load all 100 full texts**를 누르면 100편의 원문을 차례로 내려받아 이 브라우저에 색인합니다. 중지·재시도 시 완료된 자료는 유지됩니다.

브라우저에서 로컬 연결을 막으면 `http://127.0.0.1:8765/`를 열어 같은 앱을 사용하세요. GitHub 페이지와 로컬 주소의 브라우저 저장소는 서로 별개입니다. API를 선택하면 설정한 제공자에게 질문·대화 일부·검색된 문단이 전송되며 요금이 발생할 수 있습니다.

## What is included

- 100 curated foundational AI papers across 12 fields, with original learning notes.
- Titles, authors, years and identifiers verified against the arXiv API. This is a curated syllabus, **not a universal ranking**. Years denote first arXiv publication.
- On-demand full-text downloading from arXiv and PDF upload, page-preserving extraction, overlapping chunks and local IndexedDB caching.
- BM25 retrieval with explicit Korean/English concept expansion. This is lexical RAG, not embedding-based semantic search or model fine-tuning.
- When AI is connected, questions automatically fetch up to two relevant source PDFs before retrieval (optional checkbox). A library import can index all 100.
- Grounded conversation, source excerpts, page links, Korean/English explanations, comparisons and conversational quizzes.
- Full-document hierarchical summarisation: every extracted page is included in reading batches, followed by recursive reduction and synthesis. It does not summarise only the first few pages.
- Search/extractive-preview mode without a model. This mode is explicitly labelled and **does not pretend to be generated chat**.
- Export conversations with their source excerpts as Markdown. Chat is tab-memory only.

## Local setup

Install Python 3.10+ and [Ollama](https://ollama.com). Download a model supported by your machine, for example:

```powershell
ollama pull qwen3.5:4b
cd ai-paper-studio
python companion.py
```

Alternatively double-click `start-windows.bat`. Keep the companion and Ollama running. Open the GitHub Pages URL or `http://127.0.0.1:8765/`, choose **Local companion**, and click **Connect & test**.

The companion binds **127.0.0.1 only**. It proxies a fixed local Ollama endpoint and a fixed allowlist of 100 arXiv PDFs. It accepts only the local app and `https://swk99.github.io` origins; no arbitrary URL proxy, wildcard CORS or public listener. The model uses a 16,384-token context via the native Ollama API. RAM/VRAM use depends on model and context. Stop cancels the browser request; already-started local inference or billed cloud work may finish server-side.

For direct Ollama use, follow [Ollama's origin configuration](https://github.com/ollama/ollama/blob/main/docs/faq.mdx) and allow only the required page origin. The companion avoids needing that CORS change. Do not expose Ollama publicly.

## Cloud / OpenAI-compatible API

Choose **OpenAI-compatible API**, enter a trusted HTTPS `/v1` base URL, model ID and API key. The provider must support browser CORS, `GET /models`, and non-streaming `POST /chat/completions` with `max_tokens` and `temperature`. Not every provider/model accepts these parameters. Model-list checking does not prove generation quality or billing availability.

Keys are kept **in tab memory only**; they are never committed, logged, included in exports or written to browser storage. Non-secret connection preferences are stored locally. Disconnect or reload to clear the key. Use a scoped personal key and a trusted browser. GitHub Pages cannot hold a shared server-side API secret.

## Data, evidence and limitations

The repository distributes metadata, original learning notes and software — **not a scraped full-text mirror of 100 copyrighted papers**. Original PDFs are retrieved from their published source and remain in the reader's browser. Until loaded, a paper contributes its labelled learning note, not full-text evidence. Each answer distinguishes these evidence types.

PDF limits: 40 MB, 300 pages, 2 million extracted characters per document. Text extraction can corrupt equations, tables and multi-column ordering. Scanned PDFs require external OCR; this app does not interpret figure images. A summary covers all *extracted text*, not all visual content. A full-paper summary may make many model calls; progress is shown, and cloud usage may be charged per request.

BM25 is strongest when technical vocabulary matches. Korean expansion covers common terms, not arbitrary cross-language semantic equivalence. Relevant papers may still be missed. Citation validation checks label ranges/presence, **not whether claims are entailed**. Models may ignore instructions or hallucinate. Check primary evidence, especially mathematical and numerical claims.

PDF parsing is local. AI requests transmit the question, up to three recent turns, and up to eight retrieved excerpts; full-paper summarisation sends all extracted text in batches. Cache removal clears local documents, not copies already sent to an API. Browser storage quotas or private browsing can prevent persistence. Source downloads require network access and may be blocked or rate-limited; upload a downloaded PDF as a fallback. Imports are sequential with a delay; completed downloads survive cancellation.

## Development

No build or package install is needed for the frontend. PDF.js 4.10.38 is vendored with its Apache-2.0 notice; see `vendor/LICENSE`.

```bash
node tests.mjs
python -m unittest discover -s tools -p 'test_*.py'
python tools/build_catalog.py  # refresh metadata from arXiv; requires internet
python companion.py
```

`tools/seed.tsv` defines the curated syllabus and original learning notes. `build_catalog.py` verifies identifiers and generates `catalog.json`. Tests guard catalogue uniqueness, key identifier/title matches, bilingual retrieval, page chunking, complete summary batching, endpoint validation, citation labels, and companion origin/route/request checks.

Primary technical references: [PDF.js examples](https://mozilla.github.io/pdf.js/examples/), [Ollama OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx), and the arXiv links in `catalog.json`.
