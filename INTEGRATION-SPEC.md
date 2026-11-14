# Holicon Energy — ServiceM8 integration specification (v1)

## Scope
One ServiceM8 account. Two intake routes: `sales` (central sales queue) and `support` (office triage queue). No separate helpdesk or customer CRM. The website is a front-end preview; **no live API connection is included**.

## Proposed production components
- Responsive website and form UX.
- Secure server-side API endpoint `POST /api/enquiries`, never call ServiceM8 from the browser.
- Server-side validation, anti-bot/rate limiting, upload malware scanning and private file storage.
- Small integration store for idempotency keys, processing state, cross-references, audit logs and follow-up approvals. This is **not** a second CRM.
- ServiceM8 API connector authenticated with authorised credentials stored in server secrets.

## Request contract (proposed)
```json
{
  "submission_id": "uuid-v4",
  "route": "sales",
  "project_type": "Commercial",
  "contact": {"name": "Example Contact", "email": "example@example.com", "phone": "07000000000"},
  "site": {"address": "Example Road", "postcode": "PE12 0AA"},
  "answers": {"service": "Solar PV", "site": "Industrial / Warehouse", "usage": "100000"},
  "consent": {"contact_for_enquiry": true, "captured_at": "ISO-8601"},
  "attachments": []
}
```
Support uses `route: "support"`, `installer`, `manufacturer`, `issue`, `faultcode`, `details`. Never use customer-submitted values as authority to assign warranty coverage.

## Intake rules
1. Validate mandatory fields and explicit contact consent; reject unsupported files and oversized submissions.
2. Persist an idempotency key. Duplicate retry must return the existing intake reference, not create a second job.
3. Match customers conservatively by verified contact/site details; route ambiguous matches for manual office review.
4. Create a ServiceM8 job in the configured intake queue, with route, category, source, summary and internal enquiry reference. Attach files only after secure validation.
5. Persist returned ServiceM8 job UUID, timestamp and processing status. Notify the central office queue.
6. If API creation fails, retain pending request securely and alert the office; retry with exponential backoff and idempotency.
7. Support enquiries are office-triage jobs, **never automatically scheduled to an engineer**.

## Follow-up approvals
- On verified quotation-sent state, create office review tasks at days 3, 7 and 14 (next working day if needed).
- Each task contains an editable draft, quote reference and explicit `Approve`, `Skip` or `Snooze` action.
- Approval is logged with staff identity, timestamp, quote version and message body.
- Before sending, re-check that quote is still outstanding, no newer customer reply exists, no opt-out exists and no stage duplicate was sent.
- If any condition fails, stop and return to office review. Never auto-send without approval.
- Final sending channel must be chosen and tested; do not assume the ServiceM8 API exposes a particular email-send action.

## Office roles
- Office administrator: first review of all intake jobs and customer matching exceptions.
- Sales lead: quotation approval and all outbound follow-up approvals.
- Support coordinator (office): triage, remote troubleshooting and engineer authorisation.
- Engineer: only scheduled jobs; record findings in ServiceM8.
- Administrator: secrets, API errors, retention, access control and audit logs.

## Configuration checklist
- Confirm ServiceM8 plan, API permissions, supported queues/job categories, job creation and attachments endpoints, and quotation state visibility.
- Agree queue names and category codes with office team; don't hard-code assumed native ServiceM8 statuses.
- Publish privacy policy, retention schedule, secure file access and safety escalation instructions.
- Configure monitored error alerts and backup/manual processing.
- Test with dummy contacts and jobs before activating the public submission endpoint.

## Acceptance tests
1. Sales form -> exactly one job in central sales queue with correct sector and answers.
2. Support form -> office-triage job, no engineer booking.
3. Duplicate POST/retry -> no duplicate ServiceM8 job.
4. Existing customer uncertain match -> manual review, no incorrect merge.
5. Invalid file or missing consent -> rejected.
6. ServiceM8 API outage -> queued for retry and visible to office.
7. Quote follow-up -> no outbound message without staff approval.
8. Accepted/declined quote or customer reply -> pending follow-up blocked.
9. Mobile keyboard, form validation and focus flow tested.
