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

## Amazon Web Services | Cloud Support Associate (Nov 2024–Apr 2025)

*Dublin, Ireland · Enterprise customer support · Hybrid-cloud reliability*

### STAR — Restoring a customer's S3 on Outposts connectivity

**Impact at a glance:** Investigated a production storage-access incident, supported connectivity restoration, and turned the resolution into a runbook used by global support engineers.

**Situation**  
An enterprise customer experienced HTTP 404 responses when accessing S3 on Outposts in a hybrid environment connecting an on-premises data centre with the AWS Oregon Region. The customer needed a working service and an explanation of the failure; the error code alone did not establish whether the problem was in the application, storage configuration or network path.

**Task**  
Identify the underlying cause, support corrective action, and make the investigation useful beyond the immediate support case.

**Action**
- Analysed the available logs and configuration details and traced the request path across the customer's hybrid environment.
- Investigated IP subnet planning and routing, identifying a subnet-planning misconfiguration associated with the incident.
- Supported the corrective steps needed to restore the affected connectivity.
- Documented the investigation, root cause and resolution in a troubleshooting runbook that other support engineers could reuse.

**Result**  
The investigation supported restoration of the customer's affected connectivity. The resulting runbook was used by global support engineering teams, extending the value of the work beyond one incident.

**Business impact**  
Restoring access addressed the customer's immediate operational disruption. Capturing the diagnosis as reusable support knowledge also gave engineers a repeatable starting point for similar investigations, rather than leaving the resolution in a single ticket.

**Customer value**  
The customer received both practical recovery support and a specific explanation of the configuration issue. That matters because a usable service resolves the immediate problem, while a clear root cause gives the customer's technical team something concrete to correct and review.

**Leadership demonstrated:** Ownership of an ambiguous incident, detailed technical investigation, and knowledge sharing across support teams.

### STAR — Turning recurring routing issues into a support process

**Impact at a glance:** Developed a Jira-based process for investigating errors between data-centre servers and cloud storage.

**Situation**  
Recurring S3 request failures, including HTTP 404 responses in the cases I investigated, required attention to the routing between data-centre servers and cloud storage. Resolving individual tickets alone did not provide a consistent process for addressing similar issues.

**Task**  
Use the recurring failure pattern to improve how those issues were investigated and followed through.

**Action**
- Built on the existing Jira ticket workflow to develop a process focused on data-centre-to-cloud-storage errors.
- Brought IP-routing investigation into that workflow, drawing on the configuration problems encountered in customer cases.
- Connected incident investigation with reusable troubleshooting knowledge so that the work could inform subsequent support cases.

**Result**  
Developed a support-process improvement around a recurring class of hybrid-cloud problems. A measured before-and-after reduction in error rates or resolution time is not available.

**Business impact**  
The process was designed to make recurring issues easier to investigate consistently and to reduce reliance on individual engineers remembering earlier cases.

**Customer value**  
The intended benefit was a more coherent support experience: investigation focused on the relevant infrastructure path, with findings that could carry forward into future cases. This is a process benefit, not a claim of measured customer satisfaction.

**Related experience:** Troubleshot S3, CloudFront, EFS and SES, including OAI/OAC, presigned URL 403 responses, IAM, replication, encryption and CloudTrail-based investigation.

## Samsung Electronics | Software Engineer, Networks (Aug 2023–Sep 2024)

*South Korea · Verizon and AT&T customer engagements · Cloud IoT and network infrastructure*

### STAR — Automating large-scale validation for telecom customers

**Impact at a glance:** Set up and tested automated network performance workflows for **1,000 user equipment (UE) devices over 72 hours**, supporting end-to-end infrastructure validation for Verizon and AT&T engagements.

**Situation**  
Telecom customers needed evidence that integrated network infrastructure could operate under sustained load. End-to-end Cloud IoT testing involved multiple components and vendors, while the engineering team had limited capacity for repetitive execution and investigation.

**Task**  
Make large-scale testing repeatable and produce useful evidence for engineering and customer discussions about integration issues and release readiness.

**Action**
- Set up and tested an automated workflow using **Terraform** for infrastructure provisioning, **Python** for test orchestration and **Docker** for consistent execution environments.
- Automated performance-test execution at a scale of **1,000 UE across 72-hour runs**.
- Improved the collection of test results and logs to support failure reproduction and diagnosis.
- Participated directly in customer meetings with **Verizon and AT&T**, alongside the engineering work.
- Contributed to broader validation involving vDU, O-RAN MOP, Viavi/DU–E500 environments, AWS Outposts M5-to-M6 migration validation and a Red Hat vRAN proof of concept.

**Result**  
Established a repeatable large-scale testing workflow and contributed validation evidence for network software and infrastructure decisions. The automation reduced reliance on repeated manual execution and supported investigation of issues before release.

**Business impact**  
This work supported delivery on commercially significant telecom engagements by making sustained validation practical with a small engineering team. More reproducible test execution also made engineering findings easier to compare and use in release decisions.

**Commercial context:** The engagements I worked on were approximately **KRW 10 billion in revenue per project**, based on my understanding of their business scale. This describes the engagements' scale; it is not revenue personally generated by my automation.

**Customer value**  
For Verizon and AT&T, the value was evidence about how the integrated infrastructure behaved under load, supported by engineers who participated in customer discussions. Repeatable tests and usable logs provided a more concrete basis for investigating failures and assessing readiness than a one-off test result.

**Leadership demonstrated:** Identifying a capacity constraint and addressing it through reusable engineering automation.

### STAR — Extending an internal chatbot with log-based automation

**Impact at a glance:** Built a log-based automation tool as an extension to an internal chatbot to support a capacity-constrained engineering team.

**Situation**  
The team needed to investigate infrastructure-test issues despite having relatively few engineers. Repetitive work with logs consumed attention that was also needed for deeper technical analysis and customer-facing delivery.

**Task**  
Create an internal tool that addressed this recurring engineering bottleneck within an interface the team already used.

**Action**
- Identified the mismatch between the team's engineering capacity and the volume of investigation work.
- Built a log-based automation tool and extended the internal chatbot with that capability.
- Focused the tool on supporting engineers' work with test and infrastructure logs.

**Result**  
Created an internal automation capability connected to the team's existing chatbot. This complemented the automated test workflow by addressing the investigation work around test execution.

**Business impact**  
The tool targeted an operational constraint in delivering large customer projects: limited engineering capacity. Its intended value was to make routine log work more manageable and preserve engineers' attention for issues requiring judgement. Time savings and adoption rates were not formally measured.

**Customer value**  
The customer benefit was indirect: better-supported engineers could focus more attention on understanding integration issues and progressing customer work. No customer satisfaction score or direct customer endorsement is claimed for this internal tool.

**Leadership demonstrated:** Internal product thinking—recognising a user problem, building around an existing workflow, and connecting engineering tooling to delivery needs.

> **How to read customer impact:** Recovery, test scale, tool development and runbook reuse are reported outcomes. Customer-value statements explain why those outcomes matter; they are not survey results, testimonials, measured CSAT improvements or quantified downtime savings.

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
