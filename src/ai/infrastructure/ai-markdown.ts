import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Renderiza markdown de la IA a HTML sanitizado.
 * Nunca usar `v-html` con la salida de `marked` sin pasar por aquí.
 * Los mensajes del usuario se siguen mostrando como texto plano.
 */
export function renderSafeMarkdown(source: string): string {
  const raw = marked.parse(source, { breaks: true, async: false });
  const html = typeof raw === 'string' ? raw : '';
  return DOMPurify.sanitize(html);
}
