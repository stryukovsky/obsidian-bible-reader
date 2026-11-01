# Reader verification

Verified on 2026-11-01 using Node.js 24.22.1.

- `npm run build`: passes. The only external runtime import is `obsidian`; SWORD/ZIP decoding is bundled.
- `SWORD_SYNODAL_ZIP=<local RusSynodalLIO.zip> npm test`: 51 tests pass; two optional CrossWire KJV archive tests are skipped because the previous /tmp/kjv.zip fixture is no longer available. Earlier verification covered actual KJV decoding and installation. The supplied Synodal archive is exercised in this run.
- The supplied RusSynodalLIO.zip also converts to 1,189 chapters, with Russian Genesis 1, John 3, Psalm 50, James 1, Romans 1, and Revelation 22 verified. Metadata retains Synodal versification and Licht im Osten attribution.
- All 18 standard versification tables have unique book IDs, valid counts, ordered testament indexes, and portable round-tripping chapter paths, including deuterocanonical books and Psalm 151.
- Scroll tests cover backward-compatible optional percentages, changed-only flushes, idle suppression, layout restoration, stopped trackers, and rejecting samples invalidated by incoming sync or a different active file. Native scroll adapters cover editor and reading-mode scroll elements; saves use a registered five-second interval.
- Conversion tests cover exact `Bible/<translation>/<book>/<chapter>.md` paths, reference properties, verse numbers/block IDs, cross-book wikilinks, escaped source content, metadata, idempotent imports, edited-note preservation, interrupted imports/retry, activation ordering, and conversion of earlier native installations.
- History tests verify migration from single-position state, the 1,000-entry cap and eviction, persistence/reload, back/forward scroll restoration, serialized button presses, cross-book next-chapter replacement, forward-branch handling, missing files, synced-state races, and ribbon bounds/cleanup. The Git round trip transfers a full version-2 history with a cursor and per-entry scroll.
- Titled-note regressions reproduce descriptive Russian chapter filenames, resolve legacy numeric references by frontmatter, preserve real paths in history/scroll state, and reject ambiguous matches. The fix was copied into the user’s existing vault plugin with a backup of its previous bundle; runtime activation still requires a plugin/app reload.
- The plugin lifecycle test rejects access to core plugin internals and checks the exact file-reading command list after removal of the Bookmarks integration.
- Resume tests exercise ordinary file opening, opening the latest synced reference without binary modules or echo writes, ignoring unrelated files, missing notes, rapid navigation, listener cleanup, and preventing workspace restoration from overwriting a synced position.
- Existing tests retain native decoder/index/CRC/expansion checks and state validation/race/recovery coverage, including a real Git commit and second checkout.
- `npm run lint`: passes without errors or warnings. The custom reader view and its font settings were removed; standard Obsidian Markdown views handle presentation.
- `openspec validate define-bible-reader --strict`: passes.
- Tests use `happy-dom` for source markup parsing and a narrow Obsidian API mock for workspace interactions. These are not live Obsidian device tests.
- Generated `main.js` remains ignored by Git. No files were staged or committed.

## Pending device checks

A live desktop Obsidian instance and mobile Obsidian device are unavailable in this execution environment. OpenSpec tasks 4.2 and 4.3 remain unchecked. Before release, verify actual ZIP import, native Markdown editor/reading view, chapter links, workspace restoration, scroll restoration in both editor/reading modes, ribbon resume, history back/forward, Git synchronization, Synodal imports, and mobile offline reading. Follow README.md for installation and migration of earlier native imports.
