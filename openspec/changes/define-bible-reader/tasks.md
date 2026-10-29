# Tasks

## 1. SWORD decoding and durable state

- [x] 1.1 Implement native SWORD decoding and safe archive validation; verify real CrossWire KJV verses, checksums, indexes, and archive limits.
- [x] 1.2 Implement serialized reading state, external updates, conflict recovery, and backups; verify race/recovery tests and a Git commit/checkout round trip.

## 2. Markdown conversion

- [x] 2.1 Generate chapter notes and translation metadata under Bible/<translation>/<book>/<chapter>.md with escaped verses, block IDs, and adjacent chapter links; verify layout, paths, source safety, and real KJV chapter counts.
- [x] 2.2 Convert during import and offer conversion of earlier native installations; verify repeat imports, edited-note preservation, interruption/retry, and activation ordering.

## 3. Standard file reading and resume

- [x] 3.1 Remove the custom reader view/settings and open normal Markdown files from the Bible ribbon/command; test latest synced resume, missing files, first chapter, and no binary dependency.
- [x] 3.2 Track workspace Bible file-open events, ignore unrelated notes, suppress resume echo writes, and retain conflict recovery; verify rapid navigation, recovery, and listener cleanup.

## 4. Documentation and checks

- [x] 4.1 Update installation, storage, Git, migration, and verification documentation; run build, lint, tests, OpenSpec strict validation, and verify generated artifacts remain ignored.
- [ ] 4.2 Verify import, standard Markdown reading, ribbon resume, and external Git state and the native current-chapter bookmark in live desktop Obsidian; record results or unavailable environment.
- [ ] 4.3 Verify conversion, offline notes, and ribbon resume in mobile Obsidian; record device/version or unavailable environment.

## 5. Scroll and translation compatibility

- [x] 5.1 Add backward-compatible scroll percentages, five-second changed-only saves, and bounded restoration in normal Markdown views; verify idle suppression, synced-state protection, navigation cancellation, and cleanup tests.
- [x] 5.2 Replace the KJV-only index/path/state assumptions with the standard SWORD versification registry and correct metadata; verify registry invariants and non-KJV references.
- [x] 5.3 Verify the supplied RusSynodalLIO.zip converts to correctly numbered Russian Markdown chapters and retain KJV regression coverage; run exact-archive tests and document compatibility limits.

## 6. Chapter footer navigation

- [x] 6.1 Add a next-chapter link after the verses in exported notes, omitting it at the end of the translation; verify footer placement and cross-book/final-chapter cases, build, lint, and strict specification validation.

## 7. Bounded reading history

- [x] 7.1 Persist and validate a 1,000-entry history with cursor and legacy migration; verify capacity, reload, sync, corruption, and Git round-trip tests.
- [x] 7.2 Add back/forward ribbon controls and commands with scroll restoration, branch handling, and no append for next-chapter progression; verify bounds, cross-book links, cursor races, and cleanup.
- [x] 7.3 Update history/migration documentation and run build, lint, tests, and strict OpenSpec validation; retain pending live device checks.

## 8. Current reading bookmark

- [x] 8.1 Maintain one native chapter bookmark following saved state/history/sync, preserve user bookmark groups, skip scroll-only writes, and guard unavailable APIs; verify adapter, lifecycle, retry, and state integration tests.
- [x] 8.2 Document Bookmarks enablement, managed title, chapter-only behavior, compatibility boundary, and retry command; run build, lint, regression tests, and strict OpenSpec validation.

## 9. Titled chapter sync fix

- [x] 9.1 Reproduce the user's titled chapter filenames, track reference frontmatter and actual note paths, resolve older numeric references for bookmarks/resume, and preserve history/scroll safely; verify navigation, metadata, ambiguity, and bookmark regressions.
- [x] 9.2 Update documentation, run build/lint/tests/strict validation, and install the verified bundle into the existing vault plugin with a backup; require a reload before claiming live runtime verification.
