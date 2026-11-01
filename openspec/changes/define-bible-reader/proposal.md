# Proposal

## Why

Reading the Bible inside Obsidian should work offline and resume at the same translation, book, and chapter after reopening a vault or syncing it through Git. The sample plugin currently provides neither Bible content nor reading-state persistence.

## What Changes

- Convert imported SWORD translations into ordinary Markdown chapters at Bible/<translation>/<book>/<chapter>.md, read through Obsidian’s normal Markdown view.
- Save changed scroll percentages approximately every five seconds and restore them when resuming a chapter.
- Persist up to 1,000 reading positions and a history cursor in vault-local state, with back/forward ribbon controls and scroll restoration. Next-chapter progression updates the current entry without appending. Restore history through Git sync.
- Allow explicit downloads of licensed SWORD Bible modules directly into the vault, with local import as an alternative.
- Retain source modules for optional reconversion and export Markdown on installation: unlocked zText/ZIP and RawText Bible modules using standard SWORD versifications, including Synodal; reject unsupported drivers, compression, and versifications clearly.
- Keep reading and synchronization file-based: Markdown chapters plus vault-local JSON history, without core Bookmarks integration.
- Document Git inclusion rules and conflict recovery. Git commits, pulls, and pushes remain the responsibility of the user's existing workflow.

## Capabilities

### New Capabilities

- `bible-reading`: Offline chapter reading and navigation across installed translations.
- `reading-position`: Vault-local position persistence and restoration after Git synchronization.
- `translation-library`: Explicit translation installation, validation, and vault-local storage.

### Modified Capabilities

None; no existing specifications exist.

## Impact

Wire plugin commands and file-open listeners to the standard Obsidian workspace. Use import/conversion services and vault-local state; remove the custom reader view and its font settings. Retain npm, TypeScript, esbuild, and mobile-compatible Obsidian APIs. Add a documented package format and download-source disclosures; select only legally redistributable content for the initial catalog. No Git client, cloud account, telemetry, native database dependency, or runtime remote code is required.
