# Design

## Context

The initial implementation reads SWORD modules in a custom view and persists a shared vault reference. The user now requires ordinary Markdown chapter notes and standard Obsidian file views. Existing state and native source modules must remain usable.

## Goals / Non-Goals

**Goals:** Convert SWORD imports into portable, editable chapter notes, record chapter file navigation, and resume the synced reference from the Bible ribbon button.

**Non-Goals:** A custom Bible reading surface, custom typography, automatic overwriting of edited notes, Git transport, or unsupported SWORD drivers/compression.

## Decisions

### Markdown is the reading surface

Write `Bible/<module-id>/<book-name>/<chapter>.md`, e.g. `Bible/KJV/Genesis/1.md`. Module IDs and stable OSIS book mappings give deterministic paths. Exports use unpadded positive integer filenames. Users may rename them to descriptive titles; tracking reads bible-translation, bible-book, and bible-chapter properties and preserves the actual vault-relative path in an optional position.path field. Number-prefixed titles also work without reference properties. Each note includes reference frontmatter, a heading, numbered verses with block IDs, and previous/next wikilinks across available chapters. Store provenance and license/About text at `Bible/<module-id>/_translation.md`.

Parse source markup as inert text and escape it for Markdown, preventing module-provided executable HTML, images, or injected note links. The plugin only generates its own navigation wikilinks. Notes work without plugin-specific rendering and remain readable/searchable with the plugin disabled.

### Conversion before activation

Keep existing native source layout under `Bible reader/translations/` for optional regeneration. Import validates the native archive and decodes every available chapter before writing. Preflight destination files and refuse different existing content; identical files are skipped. Use create-only writes to protect edits racing conversion. Interrupted imports can leave complete chapter files; retry fills missing files without overwriting edits. Never activate a new native revision until Markdown conversion and source writes complete.

Expose an explicit conversion action for previously installed modules. Conversion is user-initiated, performed outside onload, yields between books, and uses the existing bounded block cache. Initial native compatibility remains unlocked zText/ZIP and RawText, 18 standard SWORD versifications, including Synodal, with UTF-8/Latin-1 text.

### File navigation is reading progress

Listen to workspace file-open events and recognize exact supported paths under Bible/. Opening such a note saves its translation ID, stable book ID, and chapter through the existing serialized PositionStore. Unrelated notes, metadata notes, and invalid paths do not change the reference. No source binary is needed for reading or position tracking.

The stable open-bible-reader command and ribbon button reload the shared state from disk and open the referenced note with the regular workspace openFile API. No custom ItemView is registered. With no saved position, open the first existing chapter deterministically or offer installation if the library is empty. A missing saved note is reported without replacing the reference. Receiving external state updates does not hijack another open note; the next ribbon action follows the synced reference. Suppress resume-induced writes, including semantically identical positions.

### Scroll percentage

Each history position includes optional scrollPercent (0–100, two decimal places). Old records without it remain valid and resume at the top. Record scroll events only for the active Bible Markdown view's editor or reading-mode scroll element, and flush changed percentages through serialized state writes on a registered five-second interval. Do not write on idle ticks, during restoration, or after unload. Keep source/preview DOM access inside a small adapter.

Tie pending samples to the exact state object and chapter observed at capture. Drop them after an incoming sync, navigation, or a blocked write, so an idle device cannot overwrite a remote position. The Bible button opens the chapter and reapplies its percentage after short bounded layout waits. Suppress resulting scroll events and cancel restoration after navigation or unload. All timers/listeners are registered and cleared. Up to five seconds of unsaved scrolling may be lost on abrupt exit.

### SWORD versification registry

Select book order and chapter/verse counts from the module's declared Versification, rather than assuming KJV. Include KJV, KJVA, Synodal, SynodalProt, NRSV, NRSVA, Catholic, Catholic2, Orthodox, LXX, MT, Leningrad, Vulg, German, Luther, Calvin, DarbyFr, and Segond. Preserve each module's own chapter numbering in exported notes and metadata. Use a union registry for stable book folder names and state/path validation, allowing deuterocanonical books and extended chapters. Never reinterpret an unknown system as KJV.

Counts/book lists are factual standard data checked against CrossWire's canon tables and system registrations; the SWORD engine is not bundled. Verify the supplied RusSynodalLIO ZIP end-to-end, including Russian text, Psalm 50 numbering, and Synodal New Testament ordering.

### Bounded reading history

Persist schema-version-2 state as `{ schemaVersion: 2, history: Position[], index: number }` in the existing state.json. The active position is history[index]. Cap the array at 1,000 entries, evicting the oldest on append. Validate every entry and cursor, including during sync/recovery. Load schema-version-1 single positions as one-entry histories without rewriting them until the next mutation.

A jump to a different reference appends after the active cursor and discards any forward branch. Opening the same chapter or saving scroll replaces the active entry. Advancing one chapter in the same translation also replaces that entry; detect cross-book and sparse progression from the exported Next chapter link. This keeps continuous reading as one resumable history item. Replacement preserves forward entries.

Add chevron-left and chevron-right icons beside the Bible ribbon icon, plus stable previous/next-reading-position commands. Disabled bounds follow state notifications. Back/forward actions validate the target note, open it normally, restore its scroll, then persist the cursor without adding an entry. Serialize repeated button presses; reject a stale action if synced history changes during the open. Missing targets leave the cursor intact. Register and clean up UI subscriptions.

### Renamed chapter resolution

Separate canonical export paths from stored actual note paths. Validate explicit paths remain inside the reference's Bible translation/book folder. On file-open, identify the reference from frontmatter or a numeric filename prefix and persist its actual path. Scroll tracking uses that path rather than requiring a numeric filename.

If an older history entry points to a missing numeric note, scan only that chapter's book folder for a unique matching reference; preserve scroll and history length when repairing the path after successful resume. Reject ambiguous matches. Bookmark synchronization performs the same resolution before checking file existence, so legacy entries can create bookmarks for renamed chapters without resetting state. Protect repaired writes against incoming history changes during asynchronous resolution/open.

### Current chapter bookmark

Maintain one native file bookmark titled Current Bible reading. After a successful state save, history cursor change, initial state load, or adopted Git state, point it at the active entry's existing chapter note. Do not store a heading/block subpath, scroll percentage, or editor state. Scroll-only saves find the same clean chapter bookmark and skip core save notifications. Do not change the bookmark while history is pending, blocked, empty, or its current chapter is missing.

Locate the named bookmark recursively so moving it into a bookmark group preserves its location and creation time. Preserve all unrelated items, groups, and ordering. If none exists, append a new file bookmark at the root. The fixed title identifies the managed item; renaming it makes it an ordinary user bookmark and a new named item will be created on the next sync.

Bookmarks exposes no public typed mutation API. Isolate feature detection for app.internalPlugins.getPluginById('bookmarks'), enabled instance.items, and instance.onItemsChanged(true) in a small adapter. Use the core plugin's save/refresh operation rather than editing bookmarks.json behind its in-memory state. The API shape is checked against the maintained Custom Sort adapter. If unavailable, leave user bookmarks untouched and keep reading functional; an explicit update command explains how to enable Bookmarks or reports unsupported integration. Never enable the core plugin automatically. Register subscriptions for cleanup and serialize bookmark updates, retrying a failed core save on the next request.

### Recovery and Git

Retain `Bible reader/state.json` location, validation, serialized writes, and backups, with version-1 to version-2 history migration. Keep conflict recovery available as a command/modal. Track both chapter Markdown and state in Git; source binaries are optional. Remove obsolete custom reader settings and CSS. All vault/workspace listeners are registered for cleanup.

## Risks / Trade-offs

- [Many chapter files] → Generate lazily on explicit import, yield between books, and avoid startup vault scans.
- [Existing edited notes] → Preflight all destinations and create only missing files. Report conflicts instead of overwriting annotations.
- [Interrupted import] → Keep complete notes and preserve old source revisions; retry fills missing identical output safely.
- [External Git changes] → Validate and preserve bad state, reload before resume, and never rewrite on ordinary synced resume.
- [Licensing] → Retain original configuration and emit translation metadata with the converted notes.

## Migration Plan

Existing native imports can be converted through Install translation → Convert installed modules. Existing reading-position JSON remains unchanged. The old custom view is no longer registered; future reading uses Markdown files. No chapter or source files are automatically deleted on unload or rollback.
