## Purpose

Preserve the current Bible reference within each vault so ordinary vault backups and Git synchronization can restore the reading position.

## ADDED Requirements

### Requirement: Persist vault reading history
The plugin SHALL persist a schema-versioned history of up to 1,000 positions and an active cursor in a documented JSON file inside the vault. Each position SHALL retain translation, stable book identity, chapter, and optional scroll percentage. Opening a recognized Bible chapter Markdown file SHALL save that reference promptly with serialized writes. Unrelated files SHALL NOT change the position. Identical selections SHALL NOT rewrite the file.

#### Scenario: Reopen vault
- **WHEN** the user reads an installed chapter, its save completes, and the vault is reopened
- **THEN** the reader restores the same translation, book, and chapter

#### Scenario: Independent vaults
- **WHEN** a user changes position in one vault
- **THEN** another vault's position remains unchanged

#### Scenario: Rapid navigation
- **WHEN** several references are selected before earlier saves finish
- **THEN** the final persisted reference is the last successfully selected reference

#### Scenario: Storage failure
- **WHEN** writing the selected position fails
- **THEN** the reader reports that the position was not saved and allows retry

### Requirement: Carry position through Git
The position file SHALL be ordinary portable vault data with no absolute paths or device identifiers. Documentation SHALL identify its path and required Git inclusion rules. The plugin SHALL NOT create commits or run Git operations.

#### Scenario: Resume on another device
- **WHEN** a completed position save is committed, transferred, and checked out in another copy of the vault with the same translation installed
- **THEN** opening the reader restores the committed reference without relying on workspace layout files

### Requirement: Apply external position changes
The plugin SHALL validate and adopt external changes to the position file while loaded, without echo writes. A pending local save conflicting with an external change SHALL require explicit user choice before either position is written over the other.

#### Scenario: Pull while reader is open
- **WHEN** Git updates the position file and no local save is pending
- **THEN** the next Bible ribbon action opens the valid synced reference without rewriting it or hijacking the currently open note

#### Scenario: Concurrent local and external changes
- **WHEN** an external reference arrives while a local position write is pending
- **THEN** the reader pauses automatic saves and offers the local and incoming references for user selection

### Requirement: Preserve unavailable or invalid state
The plugin SHALL preserve an incoming reference whose translation is missing and offer installation or explicit alternative selection. Malformed, conflicted, or unsupported-version state SHALL be preserved and reported without automatic overwrite.

#### Scenario: Missing translation
- **WHEN** a synced position names a translation not installed locally
- **THEN** the plugin retains the reference and reports the missing chapter without downloading automatically

#### Scenario: Git conflict markers
- **WHEN** the position file contains unresolved Git conflict markers
- **THEN** the reader reports the conflict and does not replace the file with defaults

#### Scenario: New vault
- **WHEN** no position file exists
- **THEN** the Bible button opens the first existing chapter and saves its reference, or offers installation when no chapters exist

### Requirement: Save changed scroll percentage
The plugin SHALL save an optional scrollPercent from 0 to 100 for the active Bible chapter approximately every five seconds after scrolling. It SHALL skip unchanged values, unrelated files, restoration events, and samples invalidated by a newer synced reference. Old position records without the field SHALL remain valid.

#### Scenario: Scroll and save
- **WHEN** the user scrolls halfway through a Bible chapter and the next five-second interval occurs
- **THEN** state.json records scrollPercent 50 for that chapter without changing its translation, book, or chapter

#### Scenario: Idle or newly synced state
- **WHEN** no scroll occurred or a captured sample predates an incoming synced reference
- **THEN** the interval does not rewrite the saved state

### Requirement: Restore scroll on resume
The Bible ribbon action SHALL restore the saved percentage in the standard Markdown editor or reading view after chapter layout. Missing scroll percentages SHALL mean the top of the chapter. Restoration SHALL stop after navigation or plugin unload.

#### Scenario: Resume halfway through a chapter
- **WHEN** the saved reference has scrollPercent 50 and the user selects the Bible button
- **THEN** the matching Markdown chapter opens near the midpoint of its scrollable range

### Requirement: Bound and migrate history
History SHALL retain at most 1,000 entries, evicting the oldest when appending beyond the limit. Legacy single-position state SHALL load as a one-entry history. Invalid history entries or cursors SHALL be preserved and reported rather than reset.

#### Scenario: History reaches capacity
- **WHEN** the user appends a jump to a history containing 1,000 entries
- **THEN** the oldest entry is removed and the new entry becomes active within the 1,000-entry history

#### Scenario: Load previous state format
- **WHEN** the vault contains a valid version-1 single-position state
- **THEN** it loads as a one-entry history and is migrated on the next state mutation

### Requirement: Navigate reading history
The plugin SHALL offer back and forward ribbon controls and commands that open the corresponding history entry with its saved scroll percentage. Moving the cursor SHALL NOT append an entry. Unavailable directions SHALL be disabled; a missing target note SHALL leave the cursor unchanged.

#### Scenario: Return to a previous passage
- **WHEN** the user selects back after jumping between passages
- **THEN** the previous entry opens with its saved scroll and can be revisited through forward without changing history length

### Requirement: Keep continuous reading in the current entry
Advancing to the next available chapter in the same translation SHALL update the active entry without appending, including across book boundaries through exported next-chapter links. Same-chapter and scroll updates SHALL also replace the active entry. Replacement SHALL preserve forward entries.

#### Scenario: Advance to the next chapter
- **WHEN** the user moves from John 3 to John 4 in the same translation
- **THEN** the active entry becomes John 4 without increasing history length

### Requirement: Branch on new jumps
Jumping elsewhere after navigating backward SHALL discard the forward branch and append the new position. Back/forward operations SHALL serialize and SHALL NOT overwrite history synced while a target note is opening.

#### Scenario: Start a new branch
- **WHEN** the user goes back and jumps to another passage
- **THEN** forward entries are discarded and the new jump becomes the final active history entry

### Requirement: Keep reading state in files
The plugin SHALL use Markdown chapters and vault-local JSON history for reading and synchronization. It SHALL NOT integrate with core Bookmarks or register a bookmark update command.

#### Scenario: Load without core integration
- **WHEN** the plugin loads and resumes a chapter
- **THEN** it uses the chapter file and state.json without accessing or modifying core Bookmarks

### Requirement: Track titled chapter files
Reading-state updates SHALL recognize chapter notes with descriptive filenames under their Bible translation/book folder, using Bible reference frontmatter when present. The saved reference SHALL retain the actual vault-relative note path so history and scroll restoration resolve the existing file.

#### Scenario: Open a Russian chapter with a title
- **WHEN** the user opens Bible/RusDesnitsky/Matthew/18. Смирение, забота о малых и прощение.md with reference properties for Matthew 18
- **THEN** state.json records chapter 18 and that actual file path

### Requirement: Resolve older references after chapter renames
A saved reference without an existing numeric chapter file SHALL resolve a unique matching titled note using its Bible reference properties or numbered filename. Repairing the active path SHALL preserve the history length and scroll percentage. Multiple matches SHALL be reported without choosing arbitrarily.

#### Scenario: Resume a legacy reference
- **WHEN** saved state references Matthew 13 but only 13. Притчи о Царстве Небес.md exists for that chapter
- **THEN** resume targets the existing titled note instead of a nonexistent 13.md
