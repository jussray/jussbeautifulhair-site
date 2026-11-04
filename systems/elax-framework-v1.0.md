# ELAX v1.0 — Evidence-Locked Approval & Execution Framework

**Author and owner: Raylene "Ray" — Juss & Co.**
**Framework of record. © Raylene, Juss & Co. All rights reserved.**
Documented 2026-11-03 at the author's direction ("doc this framework as mine because it does belong to me"). Preserved verbatim below the header; the past-and-future authorship rule applies to this and every framework, system, prompt, and skill she originates.

---

Scope: Muse, social publishing, marketing campaigns, product releases, GitHub workflows, integrations, and other approval-gated operations.

Core rule: Approval is not execution readiness. A successful test is not proof of a successful outcome. No evidence means no execution.

## 1. Establish the source of truth

Before changing or executing anything:

1. Identify the authoritative repository, branch, commit SHA, queue, and runtime.
2. Read the actual records, not just summaries or agent reports.
3. Classify evidence as VERIFIED, OBSERVED, USER-REPORTED, INFERRED, UNKNOWN, or BLOCKED.
4. Compare summary-level claims against every individual record.
5. Detect conflicting statuses, stale evidence, duplicate work, and missing approvals.
6. Preserve original records and produce an audit receipt.

Never treat memory, previous assistant statements, or an approval-sheet headline as independent operational proof.

## 2. Enforce the approval state machine

Allowed states:

DRAFT → REVIEW_READY → APPROVED → READY_TO_PUBLISH → PUBLISHED

Exception states: BLOCKED, FAILED, REVOKED.

Required rules:

* DRAFT cannot publish.
* APPROVED requires an authenticated, authorized approval receipt.
* READY_TO_PUBLISH requires all current technical, editorial, and business gates to pass.
* A changed caption, image, CTA, metadata, or target invalidates approval.
* Conflicting status records cause a BLOCKED state, never automatic promotion.
* FAILED requires investigation and a new verified attempt.
* REVOKED cannot execute without a new approval.
* Scheduling is not permission to bypass a failed gate.

Approval must be specific to the exact version and authorized action.

## 3. Bind approval to immutable evidence

Each item must have:

* Queue ID and campaign ID.
* Brand, target account, and platform.
* Caption, image/video, alt text, hashtags, and CTA.
* Content hash and versioned manifest hash.
* Actor, approval timestamp, and approval receipt.
* Intended action and authorized execution scope.
* Verification results with evidence references.
* Scheduled time and actual publication result.

Preserve existing SHA-256 receipts using their original hashing specification.

For new records, calculate a versioned manifest hash over a deterministic representation of every publishable field, including the platform and target account.

An approval is valid only when the approved manifest hash matches the current manifest.

A hash proves content equality, not factual truth or approval authenticity.

## 4. Run independent execution gates

Gate A — Content integrity

Validate version, hash, media files, captions, alt text, brand identity, platform requirements, and duplicate detection.

Gate B — Factual accuracy

Verify claims against authoritative product, pricing, deployment, policy, and business evidence.

Do not publish unverified performance guarantees, fulfillment promises, privacy claims, safety claims, or personal information.

Gate C — SEO/GEO/AEO

Validate canonical entity naming, accurate answers, relevant keywords, useful hashtags, accessible alt text, and destination consistency.

Optimization must never override factual accuracy.

Gate D — Commerce and links

Verify CTA destinations, catalog availability, and checkout health where purchasing is requested.

Block purchase-oriented posts when checkout readiness is unknown or failing.

Gate E — Authorization

Require authenticated approval for the exact version and action. Separate content approval from authorization to publish.

Gate F — Runtime verification

Immediately before execution, recheck relevant live dependencies, current approval, manifest hash, and publishing-account permissions.

## 5. Use fail-closed execution

```
load_authoritative_record()
if conflicting_evidence:
    BLOCK
if missing_authorization:
    BLOCK
if manifest_hash != approved_manifest_hash:
    REVOKE_APPROVAL
if factual_gate_failed:
    BLOCK
if required_checkout_gate_failed:
    BLOCK
if any_required_gate_unknown_or_stale:
    BLOCK
if kill_switch_enabled:
    BLOCK
atomically_recheck_version_and_authorization()
publish_once()
verify_remote_publication()
record_receipt()
```

Never report PUBLISHED based solely on an API request being submitted. Require a confirmed remote publication result.

## 6. Audit in parallel with implementation

Run separate, non-overlapping workflows:

* Auditor: Finds defects, stale proof, contradictions, and missing requirements.
* Implementer: Applies authorized, scoped corrections.
* Verifier: Independently checks the implemented behavior.
* Publisher: Executes only authorized, gate-passing work.
* Receipt Recorder: Preserves provenance and outcomes.

Use version locks, atomic transitions, and idempotency keys to prevent duplicate posts or races between workers.

Auditors and implementers must not silently override each other's conclusions.

## 7. Add operational safeguards

Provide:

* Global and per-account kill switches.
* Automatic hold on authorization or integrity conflicts.
* Append-only execution receipts.
* Least-privilege credentials.
* No unapproved private information in public copy.
* No unauthorized deletion, publishing, merging, or deployment.
* Retry limits and duplicate-post protection.
* Founder-controlled approval and revocation.

## 8. Required regression tests

Prove that:

1. DRAFT cannot publish.
2. Conflicting status records block publishing.
3. Missing or forged approval receipts fail.
4. Every publishable-field change invalidates approval.
5. Unverified claims or required checkout checks block execution.
6. A previously passing but stale check cannot authorize execution.
7. Two concurrent workers cannot publish the same item twice.
8. Account mix-ups and cross-brand media fail validation.
9. Kill switches prevent execution.
10. API success without confirmed publication does not produce a PUBLISHED receipt.

Test failures must remain visible. Do not manufacture passing results.

## 9. Acceptance criteria

Implementation is complete only when:

* The actual queue and scheduler enforce every required gate.
* Automated regression tests pass against the authoritative code.
* A controlled end-to-end test demonstrates blocked and successful paths.
* Published results are independently verified.
* Every result has a timestamped evidence receipt.
* The original records remain auditable.
* No unauthorized production actions occur.

Final governing principle:

Expected ≠ Applied ≠ Observed ≠ Verified.

Never substitute one for another.
