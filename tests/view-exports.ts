export { ReaderController } from '../src/reader/controller';
export { default as BibleReaderPlugin } from '../src/main';
export { PositionRecoveryModal } from '../src/reader/recovery-modal';
// @ts-expect-error Test-only JavaScript mock has no declaration file.
export { mockFile, mockPlugin } from './obsidian-mock.mjs';
export { ScrollTracker, scrollPercent, applyScrollPercent } from '../src/reader/scroll';
export { registerHistoryControls } from '../src/reader/history-controls';
export { registerCurrentReadingBookmark } from '../src/bookmarks/register';
