# OpenHub Inventory UI Design

This document supersedes the previous Dashboard, Discover, Installs, Usage,
Reviews, Security, and Settings mockup set. The generated HTML, renderer script,
and PNG artifacts for those removed surfaces have been retired.

## Current Navigation

- Home
- Inventory
- Sources
- Settings

## Product Vocabulary

Use:

- local inventory
- indexed skills
- imported skills
- agent roots
- source preview
- versions
- collections
- sync disabled
- plugins disabled
- local SQLite

Do not use runtime UI vocabulary for removed surfaces:

- Deploy
- Trust
- Installs
- Security Center
- Usage
- Reviews
- policy packs
- source reputation
- ratings
- risk scores

## Visual Direction

- Quiet desktop workbench.
- Dense but readable inventory tables.
- Compact left navigation.
- Top search and command bar.
- Full-width sections, not card stacks nested inside cards.
- Clear empty states with one next action.
- Provenance labels for local SQLite, preview, and sync-disabled state.

## Acceptance

- Renderer tests cover Home, Inventory, Sources, and Settings.
- No first-screen UI exposes removed Deploy or Trust surfaces.
- Source preview stays local/Git candidate inspection, not marketplace
  reputation.
- Agent roots are scanned for inventory only and are not write targets.
