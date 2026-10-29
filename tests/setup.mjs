import { Window } from 'happy-dom';
const window = new Window();
globalThis.window = window;
globalThis.DOMParser = window.DOMParser;
