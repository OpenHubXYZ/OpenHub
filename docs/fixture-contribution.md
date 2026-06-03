# Fixture Contribution Rules

Fixtures must be synthetic and safe to publish.

## Allowed

- Small fake `SKILL.md` files.
- Synthetic file paths under temporary directories.
- Fake tokens such as `example-token-redacted`.
- Minimal Git, ZIP, sync, and plugin fixtures created by tests.

## Not Allowed

- Real private skills.
- Real user names, customer names, API keys, local home paths, or agent root
  snapshots.
- Full local `.codex`, `.claude`, `.gemini`, or `.opencode` directories.
- Production credentials, logs, prompts, or proprietary skill contents.

## Review

Reviewers should reject fixtures that expose private content or are larger than
needed to prove the behavior. Add focused fixtures near the test that uses them.
