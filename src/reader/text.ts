// Read markup through an inert XML document, then copy only text into the live UI.
// Never insert module-supplied elements or attributes into the workspace DOM.
export function verseText(source: string, sourceType: string): string {
 if (sourceType === 'Plain') return source;
 const withoutGbf = sourceType === 'GBF'
  ? source.replace(/<RF>[\s\S]*?<Rf>/g, '').replace(/<W[HGTM][^>]*>/g, '').replace(/<CM>/g, '\n')
  : source;
 const normalized = withoutGbf.replace(/&nbsp;/g, ' ').replace(/&(?!#\d+;|#x[\da-f]+;|amp;|lt;|gt;|quot;|apos;)/gi, '&amp;');
 const document = new DOMParser().parseFromString(`<root>${normalized}</root>`, 'application/xml');
 if (document.querySelector('parsererror')) {
  // Many SWORD verses contain fragments with unmatched milestone markup.
  return normalized.replace(/<(note|title|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
   .replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
 }
 for (const element of Array.from(document.querySelectorAll('note, title, script, style, iframe, object'))) element.remove();
 return (document.documentElement.textContent ?? '').trim();
}
