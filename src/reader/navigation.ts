import type { SwordModule } from '../sword/module';
import type { Position } from '../types';

export function chapterPositions(module: SwordModule): Position[] {
 return module.books.flatMap(book => module.availableChapters(book).map(chapter => ({ translationId: module.config.id, bookId: book.id, chapter })));
}
export function adjacent(module: SwordModule, position: Position, step: number): Position | null {
 const positions = chapterPositions(module);
 const index = positions.findIndex(item => item.bookId === position.bookId && item.chapter === position.chapter);
 return index < 0 ? null : positions[index + step] ?? null;
}
export function hasPosition(module: SwordModule, position: Position): boolean {
 const book = module.books.find(book => book.id === position.bookId);
 return !!book && module.availableChapters(book).includes(position.chapter);
}
