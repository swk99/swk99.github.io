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
