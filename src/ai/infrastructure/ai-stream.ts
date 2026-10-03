/**
 * Parser SSE puro para `streamGenerateContent?alt=sse` de Gemini.
 * Sin DOM ni fetch: recibe trozos de texto y emite tokens vía callback.
 */

export interface SseParser {
  /** Alimenta un trozo crudo del stream. Tolera JSON cortado entre trozos. */
  feed(chunk: string): void;
  /** Vacía el buffer restante al cerrar el stream. */
  flush(): void;
}

/** Extrae el texto de un payload `streamGenerateContent` con guards. */
export function extractGeminiText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content
    ?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) =>
      typeof (p as { text?: unknown }).text === 'string'
        ? (p as { text: string }).text
        : ''
    )
    .join('');
}

export function createSseParser(onToken: (token: string) => void): SseParser {
  let buffer = '';

  const processLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice('data:'.length).trim();
    if (data === '' || data === '[DONE]') return;
    try {
      const token = extractGeminiText(JSON.parse(data) as unknown);
      if (token) onToken(token);
    } catch {
      // JSON cortado: se conserva en el buffer y se reintenta con el
      // siguiente trozo (ver feed). Si falla tras flush, se descarta.
    }
  };

  return {
    feed(chunk: string): void {
      buffer += chunk;
      // Conserva la última línea (posiblemente incompleta) en el buffer.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        // Si la línea parece JSON incompleto, devuélvela al buffer.
        if (line.trim().startsWith('data:')) {
          const data = line.trim().slice('data:'.length).trim();
          if (data !== '' && data !== '[DONE]') {
            try {
              JSON.parse(data);
            } catch {
              buffer = line + '\n' + buffer;
              continue;
            }
          }
        }
        processLine(line);
      }
    },
    flush(): void {
      if (buffer.trim() !== '') processLine(buffer);
      buffer = '';
    },
  };
}
