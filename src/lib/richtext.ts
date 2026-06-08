/**
 * Lightweight rich-text helpers. A field's text can be either:
 *   - plain text (optionally with legacy `**bold**` markers and \n line breaks), or
 *   - a small, sanitized HTML subset (b/i/u/span with color & font-size, <br>).
 * The editor produces sanitized HTML; the renderer detects which form a value is in.
 */

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'BR']);
const ALLOWED_STYLES = ['color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'];

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** True if the value already carries rich HTML formatting. */
export function isRichHtml(v: string): boolean {
  return typeof v === 'string' && /<(b|strong|i|em|u|span|font)\b|<br\s*\/?>/i.test(v);
}

/** Seed the editor: convert legacy plain / `**bold**` text into the HTML the editor understands. */
export function markupToHtml(v: string): string {
  if (v == null) return '';
  if (isRichHtml(v)) return v;
  let h = escapeHtml(v);
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/\r?\n/g, '<br>');
  return h;
}

/** Plain-text version (e.g. for length checks). */
export function stripHtml(v: string): string {
  if (!isRichHtml(v)) return v;
  if (typeof document === 'undefined') return v.replace(/<[^>]+>/g, '');
  const el = document.createElement('div');
  el.innerHTML = v;
  return el.textContent || '';
}

/** Strip everything except the allowed inline-formatting subset; normalise block tags to <br>. */
export function sanitizeHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const src = document.createElement('div');
  src.innerHTML = html;
  const out = document.createElement('div');

  const walk = (from: Node, to: HTMLElement) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const elNode = node as HTMLElement;
      const tag = elNode.tagName;

      if (tag === 'BR') { to.appendChild(document.createElement('br')); return; }

      if (tag === 'DIV' || tag === 'P') {
        if (to.lastChild && to.lastChild.nodeName !== 'BR') to.appendChild(document.createElement('br'));
        walk(elNode, to);
        return;
      }

      if (ALLOWED_TAGS.has(tag)) {
        let clean: HTMLElement;
        if (tag === 'FONT') {
          clean = document.createElement('span');
          const color = elNode.getAttribute('color');
          if (color) clean.style.color = color;
        } else {
          clean = document.createElement(tag.toLowerCase());
        }
        if (elNode.getAttribute('style')) {
          ALLOWED_STYLES.forEach((p) => {
            const val = elNode.style.getPropertyValue(p);
            if (val) clean.style.setProperty(p, val);
          });
        }
        walk(elNode, clean);
        to.appendChild(clean);
        return;
      }

      // Unknown/disallowed tag → keep its text children only.
      walk(elNode, to);
    });
  };

  walk(src, out);
  return out.innerHTML;
}
