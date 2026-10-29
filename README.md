# Bible Reader for Obsidian

Import a SWORD Bible and read it as ordinary Markdown notes. The Bible ribbon button opens your last reading position, including a position synced through Git.

## Use

1. Run **Bible Reader: Install translation** from the command palette.
2. Select **Choose ZIP** for a local SWORD module, or explicitly select **Download KJV** to retrieve CrossWire's King James Version.
3. Conversion generates chapter notes:

```text
Bible/
  KJV/
    _translation.md
    Genesis/
      1.md
      2.md
      ...
    John/
      1.md
      2.md
      3.md
      ...
```

`KJV` is the source module's stable identifier. Book folders use readable book names; exports use unpadded chapter numbers. You may rename chapter notes to descriptive filenames such as `18. Смирение, забота о малых и прощение.md`. Keep their `bible-translation`, `bible-book`, and `bible-chapter` properties: tracking uses those references and saves the actual file path. Number-prefixed filenames are also recognized without properties.

Open these files from Obsidian's file explorer, search, or their previous/next chapter links. They use the normal Markdown editor and reading view, with Obsidian's normal fonts and settings. Each exported chapter also ends with a **Next chapter** link, except for the final available chapter. Each chapter has reference properties, numbered verses, and verse block IDs such as `^v16` for linking to a verse. `_translation.md` contains source and licensing information. Notes remain readable and editable with the plugin disabled.

Opening a Bible chapter saves its translation, book, and chapter. Changed scroll percentages are saved about every five seconds while that chapter is active, in both reading and editing modes. Idle intervals do not write state. The Bible button also restores the saved scroll percentage after layout; old records without a percentage start at the top. Abrupt exit may lose up to five seconds of scrolling. Opening unrelated notes leaves this position unchanged. Select the **Bible ribbon button** or **Bible Reader: Open reader** to open the saved chapter in a normal file tab. The button reloads state from disk, so a newly synced position is used. Incoming sync changes do not interrupt another note you are reading.

With no saved position, the button opens the first available chapter; an empty library offers installation. If a saved chapter is missing, the plugin reports its path and preserves the position rather than opening a different chapter.

### Reading history

The **‹** and **›** buttons beside the Bible ribbon button move backward and forward through up to **1,000 saved reading positions**, restoring each entry's scroll percentage. The corresponding commands are **Previous reading position** and **Next reading position**. Buttons are disabled at history boundaries.

Jumping to another passage or translation adds an entry. Advancing to the next chapter in the same translation—including a next-chapter link across book boundaries—updates the current entry instead of appending. Scroll changes also update only that entry. Going back and then jumping elsewhere replaces the forward branch; ordinary next-chapter or scroll updates preserve it. The oldest entry is removed when an append exceeds 1,000 entries. Missing chapter files leave the history cursor unchanged.

History and its cursor sync through the same state.json file. Version-1 single-position data loads as a one-entry history, preserving its scroll; the next save writes version-2 history. Keep devices on the updated plugin version after migration.

### Current reading bookmark

Enable **Bookmarks** in **Settings → Core plugins**. Bible Reader maintains one native file bookmark named **Current Bible reading** pointing to the active saved history entry's chapter. It follows normal navigation, next-chapter progression, back/forward, and newly synced reading state. It contains no heading, verse, cursor, or scroll location. Scroll-only saves do not rewrite bookmarks.

You can move this bookmark into a bookmark group; it stays there as its chapter target updates. Other bookmarks and groups are preserved. Keep its managed title if you want it to follow your position; renaming it preserves it as an ordinary bookmark and allows a new **Current Bible reading** item to be created.

To retry after enabling Bookmarks, run **Bible Reader: Update current reading bookmark**. A missing chapter, invalid history, disabled Bookmarks, or incompatible core API leaves existing bookmarks alone. The plugin does not enable core plugins for you.

The Bookmarks plugin saves this item through its own settings and persistence. You do not need to sync its configuration to reconstruct the bookmark on another device: Bible Reader recreates it from the synced reading history when Bookmarks is enabled. The integration uses a guarded internal API because Obsidian provides no public bookmark mutation API; compatibility is checked before changing anything. It does not directly rewrite bookmarks.json.

### If state or bookmark sync appears stuck

Reading history is stored in **`Bible reader/state.json`**. **Current Bible reading** appears in Obsidian's **Bookmarks sidebar**, not as a Markdown note in your vault. The core Bookmarks plugin persists it through its own configuration.

After updating the plugin bundle, reload the plugin or Obsidian and open another Bible chapter. Titled filenames are supported, including Russian names; do not remove the chapter's Bible reference properties. Older saved numeric references are resolved to matching titled files without resetting history. If several notes claim the same chapter, open the intended one to record its exact path.

### Existing imports and re-importing

If you used the earlier custom reader, run **Install translation → Convert installed modules** to create Markdown from its existing native modules without downloading again. The previous state file still points to the same translation/book/chapter.

An import checks all output paths before writing. Identical existing notes are skipped. Different existing content, including your annotations, is preserved and the conflicting path is reported. To deliberately replace a translation, first move or back up that translation's Markdown folder. There is no silent overwrite or deletion of your notes.

An interrupted conversion may leave complete chapter notes. Retry the same import to fill missing files; edited existing notes are still protected. The source installation becomes active only after conversion and native source writes finish.

## Vault storage and Git

- `Bible/<translation>/<book>/<chapter>.md`: the readable Bible chapters.
- `Bible/<translation>/_translation.md`: translation provenance and license/About notices.
- `Bible reader/state.json`: schema-version-2 reading history (up to 1,000 entries) and active index. Each entry contains translation ID, stable book ID, chapter, optional scrollPercent (0–100), and an optional actual note path for renamed chapters.
- `Bible reader/translations/<module-id>/<archive-sha256>/`: retained native source files and activation record, used only for optional reconversion.
- `Bible reader/state-backup-<time>.json`: original state preserved during explicit recovery.

Track **`Bible/`** and **`Bible reader/state.json`** in Git. Source binaries are optional: chapter reading and position tracking work without them. You can exclude source archives yourself with:

```gitignore
/Bible reader/translations/
```

The plugin does not create commits, push, pull, or alter ignore rules. Position saves are serialized immediately after chapter file-open events; wait for disk writes to complete before committing. If saving fails, a notice reports the problem. A commit taken before a save finishes may contain the previous position.

On another device, pull the chapter notes and state, then select the Bible button. For example, a KJV/John/3 reference opens `Bible/KJV/John/3.md`; no SWORD binary or separate reader layout is required.

For invalid JSON, unresolved Git markers, deleted state, or competing local/synced writes, run **Bible Reader: Recover reading position**. Use **Open saved chapter** to reload the synced state, or **Keep local chapter** to back up the existing state and save the most recently opened local chapter. No state file is replaced with defaults automatically. External Git writes cannot be made transactional with Obsidian writes, so inspect simultaneous edits from multiple devices.

## Supported SWORD imports

- Unlocked `zText` with `CompressType=ZIP` and book/chapter/verse blocks, or six-byte-index `RawText` Bible modules.
- Standard SWORD versifications: **KJV, KJVA, Synodal, SynodalProt, NRSV, NRSVA, Catholic, Catholic2, Orthodox, LXX, MT, Leningrad, Vulg, German, Luther, Calvin, DarbyFr, Segond**. UTF-8 or Latin-1 text, and OSIS, ThML, GBF, or plain source markup.
- A single-module ZIP with `mods.d/<module>.conf` and matching `modules/texts/...` files, such as CrossWire's rawzip downloads.

Locked modules, zText4/RawText4, non-ZIP compression, unknown/custom versifications, commentaries, dictionaries, and MyBible databases are rejected clearly. Each module’s declared book order and numbering are respected; KJV is only the SWORD default when no versification is declared. Synodal, Catholic, and other canons can include additional books and chapters. Conversion produces plain verse text; source headings, notes, Strong's lookups, and morphology are not presented. Source markup is parsed as inert text and escaped for Markdown. The plugin generates only its own navigation links.

Limits: 32 MiB compressed archive, 64 MiB total expanded data, 100 archive entries, and 16 MiB per decompressed SWORD block. ZIP paths, CRCs, module indexes, and compressed-block checksums are validated. Conversion happens only on explicit import/conversion actions, outside plugin startup, and yields between books.

### Import a Russian Synodal Bible

Run **Install translation → Choose ZIP** and select `RusSynodalLIO.zip`. It declares Synodal versification and converts to `Bible/RusSynodalLIO/<book>/<chapter>.md`, for example `Bible/RusSynodalLIO/Psalms/50.md`. Its translation license and Licht im Osten attribution are retained in `_translation.md`. No special KJV module or conversion through KJV numbering is required.

The factual book lists/counts are checked against [CrossWire's standard canon tables](https://github.com/bibletime/crosswire-sword-mirror/tree/master/include). No SWORD engine code is bundled.

## Downloads and privacy

The bundled download entry is [CrossWire's official KJV ZIP](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/KJV.zip), approximately 4 MiB. Only selecting **Download KJV** contacts `www.crosswire.org`; ordinary connection metadata such as your IP address is sent. Vault contents, filenames, and reading position are never transmitted. There is no telemetry, account requirement, background download, or remote executable code.

The downloaded module declares `DistributionLicense=GPL`; its About metadata includes additional CrossWire permissions and notices concerning the Crown's KJV base-text rights. These are retained in `_translation.md` and the original configuration. Review translation licensing before distributing a vault; module licensing is separate from this plugin's license.

Downloads use Obsidian's buffered request API, so the archive-size check occurs after receiving the response. Local import, reconversion, normal chapter reading, and ribbon navigation operate offline.

## Install and develop

Use Node.js 24 LTS (tests require Node.js 22.8 or newer):

```sh
npm install
npm run build
npm run lint
npm test
```

Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/sample-plugin/`, then enable **Bible Reader** in **Settings → Community plugins**. The existing scaffold ID is retained. Requires Obsidian 1.7.2 or newer.

To verify a real CrossWire archive in addition to the synthetic fixtures:

```sh
SWORD_KJV_ZIP=/absolute/path/to/KJV.zip SWORD_SYNODAL_ZIP=/absolute/path/to/RusSynodalLIO.zip npm test
```

Tests do not download implicitly. The runtime uses bundled `fflate` for native SWORD/ZIP decoding, with no native SWORD engine or Node/Electron dependency. Tests use `happy-dom` for XML/DOM behavior and a narrow Obsidian API mock. Live desktop/mobile verification remains necessary before release.
