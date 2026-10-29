export const notices = [];
export class Notice { constructor(message) { notices.push(message); } }
export class ItemView {
 constructor(leaf) { this.contentEl = leaf.contentEl; this.app = leaf.app; }
}
export class Modal {
 constructor(app) { this.app = app; this.contentEl = document.createElement('div'); }
 setTitle(text) { this.title = text; }
 open() { this.onOpen(); }
 close() { this.onClose(); }
}
export class Setting {
 constructor(parent) { this.element = parent.createDiv(); }
 setName(text) { this.element.createSpan({ text }); return this; }
 setDesc(text) { this.element.createSpan({ text }); return this; }
 addButton(callback) {
  const element = this.element.createEl('button');
  const button = { setButtonText(text) { element.textContent = text; return button; }, setCta() { return button; }, onClick(fn) { element.addEventListener('click', fn); return button; } };
  callback(button); return this;
 }
}
export function requestUrl() { throw new Error('Unexpected network request in offline UI test'); }
export class TFile { constructor(path) { this.path = path; } }
export class PluginSettingTab {
 constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement('div'); }
}
export class Plugin {
 callbacks = [];
 commands = [];
 ribbons = [];
 views = new Map();
 constructor(app) { this.app = app; }
 loadData() { return Promise.resolve(null); }
 saveData() { return Promise.resolve(); }
 registerInterval(id) { this.callbacks.push(() => window.clearInterval(id)); return id; }
 registerDomEvent(element, type, callback, options) { element.addEventListener(type, callback, options); this.callbacks.push(() => element.removeEventListener(type, callback, options)); }
 register(callback) { this.callbacks.push(callback); }
 registerEvent(event) { this.callbacks.push(() => { this.app.vault.offref(event); this.app.workspace.offref(event); }); }
 registerView(type, factory) { this.views.set(type, factory); this.callbacks.push(() => this.views.delete(type)); }
 addRibbonIcon(icon, title, action) { const element = document.createElement('div'); if (icon === 'book-open') this.ribbon = action; this.ribbons.push({ icon, title, action, element }); return element; }
 addCommand(command) { this.commands.push(command); }
 addSettingTab(tab) { this.tab = tab; }
 unload() { for (const callback of this.callbacks.reverse()) callback(); }
}
export function mockFile(path) { return new TFile(path); }

export class MarkdownView {}

export function mockPlugin(app) { return new Plugin(app); }
