## Purpose

Make Bible chapters ordinary Obsidian Markdown notes so users can read, edit, search, and link them with native vault tools.

## ADDED Requirements

### Requirement: Read standard Markdown chapters
The plugin SHALL create chapter notes at Bible/<translation>/<book>/<chapter>.md and open them through Obsidian's standard Markdown file view. Notes SHALL include verse labels and remain readable without the plugin.

#### Scenario: Open an imported chapter
- **WHEN** a user opens Bible/KJV/John/3.md
- **THEN** Obsidian displays a normal Markdown note containing John 3 with numbered verses

### Requirement: Navigate using chapter links
Generated notes SHALL link to previous and next available chapters, including across book boundaries, without links beyond the installed translation's content. Every chapter with a successor SHALL also end with a next-chapter link after its verses.

#### Scenario: Cross book boundary
- **WHEN** the user follows the next chapter link in the final Genesis chapter
- **THEN** Obsidian opens the first available Exodus chapter

#### Scenario: Continue at the end of a chapter
- **WHEN** the user reaches the end of an exported chapter with a successor
- **THEN** the final Markdown content links to that next chapter, including across book boundaries

### Requirement: Resume from the Bible button
Selecting the Bible ribbon button or open-reader command SHALL read the synced position and open its Markdown chapter. It SHALL NOT create a custom reader view or require source binaries to open existing notes.

#### Scenario: Resume a synced chapter
- **WHEN** the saved position is KJV John 3 and the user selects the Bible button while another note is open
- **THEN** Obsidian opens Bible/KJV/John/3.md without replacing the saved reference

#### Scenario: Missing saved note
- **WHEN** the saved chapter file is absent
- **THEN** the plugin reports the missing path and preserves the saved position

#### Scenario: Empty vault
- **WHEN** the user selects the Bible button without a saved position or any chapter notes
- **THEN** the plugin offers installation without starting a download

### Requirement: Escape converted source content
Conversion MUST reduce source markup to safe text and escape Markdown control syntax. It MUST prevent source-provided scripts, HTML, images, or injected links from becoming active note content.

#### Scenario: Malicious source text
- **WHEN** an imported verse contains HTML handlers or Markdown image syntax
- **THEN** the resulting chapter contains literal safe text and no executable source markup or image embeds
