# Security Response Playbook

Use this playbook for private vulnerability reports and suspected security
regressions.

## Intake

- Prefer GitHub private vulnerability reporting.
- If private reporting is unavailable, use the contact in `SECURITY.md`.
- Acknowledge receipt within 5 business days.
- Do not request unredacted secrets, full private skill contents, or private
  local paths unless absolutely necessary.

## Triage

- Confirm affected commit, versions, and reproduction.
- Classify impact: path traversal, credential exposure, install bypass,
  renderer privilege escape, plugin escape, sync privacy issue, or scan bypass.
- Assign `priority:p0` for active exploitation, private data exposure, or
  release-blocking vulnerabilities.

## Fix And Disclosure

- Keep discussion private until mitigation is ready.
- Add or update tests before the fix when feasible.
- Prepare a security note with impact, affected versions, mitigation, and
  credit.
- Publish after the fix is available unless active exploitation requires faster
  disclosure.
