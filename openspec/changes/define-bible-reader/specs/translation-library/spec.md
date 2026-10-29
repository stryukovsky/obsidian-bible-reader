## Purpose

Install and maintain Bible translation packages in the vault with explicit network consent, provenance, and reliable offline access.

## ADDED Requirements

### Requirement: Explicit vault installation
The plugin SHALL allow users to download a supported SWORD module ZIP directly into a vault-local library or import that package from a local file. Before downloading it SHALL disclose the source, translation identity, license, and expected size. Downloads SHALL require explicit user action and SHALL send no vault content or reading position.

#### Scenario: Download a translation
- **WHEN** the user confirms a listed translation download
- **THEN** the plugin retrieves its content from the disclosed source and installs it in the configured vault folder

#### Scenario: No network consent
- **WHEN** the plugin starts or a saved translation is missing
- **THEN** it does not contact translation servers automatically

#### Scenario: Import offline
- **WHEN** the user supplies a valid supported package locally
- **THEN** it installs without a network request

### Requirement: Validate packages before activation
The plugin SHALL validate SWORD metadata, translation identity, verse indexes, archive limits, and vault-relative paths before activation. Interrupted, oversized, malformed, or unsafe packages SHALL NOT replace a working installation and SHALL produce an actionable error.

#### Scenario: Interrupted download
- **WHEN** a translation download fails before validation completes
- **THEN** it is not listed as installed and an existing installation remains readable

#### Scenario: Unsafe package path
- **WHEN** a package includes an absolute path or parent traversal
- **THEN** installation is rejected without writing outside the library

### Requirement: Portable licensed library
Imports SHALL convert all available chapters to Markdown under Bible/<translation>/<book>/<chapter>.md and retain available provenance and license/About metadata in a translation note. Native source files SHALL remain available for optional reconversion. Reading converted notes SHALL require no binary module access.

#### Scenario: Inspect installed translation
- **WHEN** the user opens Bible/KJV/_translation.md offline
- **THEN** the note shows its identity, source, and licensing information from vault-local metadata

### Requirement: Document format boundaries
The plugin SHALL support unlocked zText modules using ZIP compression and RawText Bible modules with standard SWORD versifications, including Synodal. Unsupported drivers, compression methods, locked modules, MyBible databases, and unknown versifications SHALL be rejected with an explicit reason.

#### Scenario: Raw ecosystem module
- **WHEN** a user imports a locked module, unsupported SWORD variant, or MyBible database
- **THEN** the plugin identifies the unsupported format and leaves the existing library unchanged

### Requirement: Preserve existing Markdown edits
Conversion SHALL preflight destinations and refuse to overwrite different existing content. Identical notes SHALL be skipped. Interrupted imports SHALL be retryable by filling missing notes while preserving existing files.

#### Scenario: Edited chapter exists
- **WHEN** an import would replace an existing chapter containing different content
- **THEN** conversion reports the conflicting path and preserves the edited note

#### Scenario: Reconvert an earlier native installation
- **WHEN** the user requests conversion of previously installed source modules
- **THEN** chapter notes are generated without downloading again

### Requirement: Respect each translation's versification
Conversion SHALL use the module's declared SWORD versification for book order, verse indexes, and chapter numbering. It SHALL include available books outside the KJV canon and record the actual versification in translation metadata.

#### Scenario: Russian Synodal import
- **WHEN** the user imports RusSynodalLIO with Versification=Synodal
- **THEN** the plugin generates correctly indexed Russian chapter notes, including Synodal Psalm 50 and the Synodal New Testament book order

#### Scenario: Additional canonical books
- **WHEN** a supported translation contains deuterocanonical books or chapters such as Psalm 151
- **THEN** generated paths and saved references retain those books and chapters
