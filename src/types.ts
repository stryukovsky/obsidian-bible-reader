export interface Position {
 translationId: string;
 bookId: string;
 chapter: number;
 scrollPercent?: number;
 path?: string;
}
export interface Verse {
 number: number;
 text: string;
}
export function errorMessage(error: unknown): string {
 return error instanceof Error ? error.message : String(error);
}
