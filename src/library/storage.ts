export interface Storage {
 read(path: string): Promise<string | null>;
 readBinary(path: string): Promise<Uint8Array>;
 write(path: string, text: string): Promise<void>;
 create(path: string, text: string): Promise<void>;
 writeBinary(path: string, bytes: Uint8Array): Promise<void>;
 list(path: string): Promise<{ files: string[]; folders: string[] }>;
}
export const ROOT = 'Bible reader';
export const LIBRARY = `${ROOT}/translations`;
export const STATE_PATH = `${ROOT}/state.json`;
