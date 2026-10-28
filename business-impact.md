---
layout: page
title: "Engineering & Business Impact"
permalink: /business-impact/
---
# Seonwoo Kim — Engineering & Business Transformation

*Financial technology · Cloud reliability · Telecom infrastructure · Applied AI*

I turn operational failure modes into reliable, observable and auditable engineering workflows. My experience spans London Mutual Credit Union, Amazon Web Services, Samsung Electronics, and earlier battery and semiconductor engineering.

> **Impact reporting:** The STAR cases below distinguish confirmed activities and observed workload figures from potential business benefits. Unverified savings and deployment outcomes are not claimed.

## London Mutual Credit Union | Software Developer (Apr 2026–present)

### STAR — Financial reconciliation and operational control
**Situation:** Cutoff dates, weekend handling and mismatched journal entries complicated reconciliation.  
**Task:** Improve matching reliability and investigate processing exceptions.  
**Action:** Worked with journal-reference/amount matching, account/amount fallback, cutoff logic, Friday exceptions and holiday-calendar handling.  
**Result:** Analysed a run covering **5,351 reconciliation records** and **1,110 post-cutoff records**, isolating remediation requirements. These are processed volumes, not a claim of error reduction.  
**Business impact:** Stronger exception visibility and financial-control traceability.

### STAR — Resilient customer card blocking
**Situation:** Telephone-initiated card blocking relied on external verification and banking APIs.  
**Task:** Make the journey recoverable, auditable and resistant to duplicate processing.  
**Action:** Designed two-step verification/blocking, request idempotency, .NET 8 event persistence, retries, explicit outcomes, crash recovery and fault-injection UAT.  
**Result:** Developed an implementation and test approach including a **30,000-record** JSON UAT workload. Production customer outcomes are not verified.  
**Business impact:** Clearer failure handling and a safer foundation for customer-protection services.

### STAR — AI-powered CRM and loan correspondence
**Situation:** Operational correspondence was fragmented and difficult to reuse.  
**Task:** Structure information and support staff decisions with AI.  
**Action:** Worked on email-data migration, LLM-assisted CRM recommendations, conversation grouping, chronological train/validation/test splits and data-quality validation.  
**Result:** Analysed **3,450 emails**, identifying **52 missing bodies** and **164 missing subjects**. Adoption and time savings remain unmeasured.  
**Business impact:** A foundation for searchable, structured and potentially faster loan-workflow support.

### STAR — ML deployment diagnostics and platform reliability
**Situation:** An internal Flask model API encountered runtime dependency errors.  
**Task:** Distinguish application faults from execution-environment faults.  
**Action:** Planned Python environment, dependency, port, console-log and API diagnostics; worked with Windows Server, CI/CD, monitoring and service-recovery design.  
**Result:** Established a systematic troubleshooting approach; final remediation metrics are not verified.  
**Business impact:** Better fault isolation and operational maintainability.

## Amazon Web Services | Cloud Support (Nov 2024–Apr 2025)

### STAR — Cloud customer reliability
**Situation:** Storage and content-delivery configuration failures disrupted customer workflows.  
**Task:** Identify causes and safe remediation paths.  
**Action:** Troubleshot S3, CloudFront, EFS and SES, including OAI/OAC, presigned URL 403 responses, IAM, replication, encryption and CloudTrail-based investigation.  
**Result:** Supported cloud issue diagnosis and customer remediation; case-volume and financial impact are not documented.  
**Business impact:** More reliable cloud operations and reduced configuration uncertainty.

## Samsung Electronics | Network Infrastructure / Software QA (Aug 2023–Sep 2024)

### STAR — Telecom interoperability and release confidence
**Situation:** Virtualised radio access infrastructure required rigorous multi-vendor validation.  
**Task:** Detect integration and resilience risks before deployment.  
**Action:** Worked with vDU, O-RAN MOP, Verizon Cloud IoT, Viavi/DU–E500 test environments, **72-hour stress testing**, AWS Outposts M5→M6 validation and a Red Hat vRAN PoC.  
**Result:** Contributed validation evidence for network software and infrastructure decisions. The test duration is not an uptime improvement claim.  
**Business impact:** Stronger evidence for release readiness and platform compatibility.

## Earlier Engineering and Research

### LG Energy Solution — Battery software research
**Situation/Task:** Support software-oriented battery engineering research.  
**Action:** Participated in battery software research; detailed deliverables require verification.  
**Result:** Cross-domain experience in research-led engineering, without an unverified commercial claim.

### Top Engineering — Semiconductor engineering
**Situation/Task:** Work in a precision-focused semiconductor engineering environment.  
**Action:** Gained engineering experience; specific projects and outcomes require source confirmation.  
**Result:** Developed industrial engineering and quality-process exposure.

### Autonomous Bed — Capstone team lead
**Situation:** A multidisciplinary product concept needed coordinated execution.  
**Task/Action:** Led the engineering team and project delivery.  
**Result:** Demonstrated technical leadership and end-to-end ownership; performance metrics require confirmation.

## Research evidence (not production KPIs)
- **PA-AHS:** Experimental Prefix-F1@10% ≈ **0.997**, worst-window F1 ≈ **0.901**.
- **AutoFair:** Fairness-analysis work spanning approximately **1.7 million records**.
- **DASH:** Two-environment replication and ten research figures.
- **DAG-RAG:** FAISS/BM25 retrieval and ablation research.
- **PySpark ML:** Academic random-forest ROC-AUC **0.983**, PR-AUC **0.975**.

## My recurring business contribution
**Operational friction → structured automation.** **Integration failure → durable recovery.** **Infrastructure uncertainty → validated evidence.** **Unstructured data → decision support.**

*Public version: no customer personal data, private endpoints, sensitive internal financial values or unverified cost-saving claims.*


## Financial impact and ROI — transparent estimation

**Important:** No independently verified realised GBP savings have been provided. The figures below are *illustrative scenario estimates*, **not achieved savings, audited ROI or production outcomes**. They must not be presented in a CV as money already saved.

| Workstream | Assumption | Illustrative value | Evidence needed |
|---|---|---:|---|
| Reconciliation | 0.5 hours saved per working day × 250 days × £25 loaded hourly cost | **£3,125/year** | Before/after handling time, actual working days, finance-approved hourly cost |
| Loan email triage | 3,450 emails × 3 minutes saved per email × £20/hour | **£3,450 one-off** | Proportion of emails actually processed, measured per-email reduction, actual staff cost |
| Card blocking | 500 requests/month × 4 minutes saved × £20/hour × 12 | **£8,000/year** | Production volumes, manual baseline, automation coverage, unit costs |
| CI/CD automation | 4 engineer-hours/week × 52 × £30/hour | **£6,240/year** | Actual automated tasks, time logs, salary/loading model |

**Illustrative recurring annual potential (excluding one-off email backfile): £17,365/year.** This combines independent hypothetical workstreams; it is **not** an attributable realised total. The email backfile scenario adds a separate **£3,450 one-time** potential, not annual recurring savings. These scenarios may overlap and should not be summed for a formal business case without deduplication.

### Financial-control distinction: reconciliation variance is not savings
A previously reviewed reconciliation snapshot recorded nominal net **−£114,886.42** and reconciliation net **−£118,043.98**; the arithmetic difference is **£3,157.56**. This represents a **variance requiring investigation**, not a recovered sum or a cost saving. These internal financial figures are intentionally **excluded from the public portfolio** and should remain in a private evidence workbook.

### Stronger interview-ready impact statements
- **Reconciliation:** "Investigated reconciliation exceptions across a 5,351-record run and identified cutoff/weekend-processing risks; developed a measurement framework for manual-review reduction."
- **Loan AI:** "Structured a 3,450-email dataset to support AI-assisted classification and recommendations; quantified potential processing-time benefits using an explicit per-message baseline."
- **Card blocking:** "Designed an auditable, recoverable card-blocking workflow and tested a 30,000-record workload; modelled the customer-service capacity benefit pending production validation."
- **Cloud/telecom:** "Contributed to multi-vendor network and cloud validation, including 72-hour stress tests; did not attribute unsupported revenue or downtime savings."

### Evidence register to convert estimates into verified outcomes
1. Baseline and post-change cycle times, using comparable samples.
2. Monthly/annual production volumes and actual automation coverage.
3. Fully loaded labour costs approved for external reporting.
4. Deployment date, attribution, exception rates and rework.
5. Sign-off from the business owner before claiming realised GBP savings.

**ROI formula:** `(validated annual benefit - annual operating cost) / implementation cost × 100%`. Count avoided losses separately from labour savings, and do not count a financial variance as recovered funds.
