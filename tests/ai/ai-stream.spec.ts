import { describe, expect, it, vi } from 'vitest';
import { createSseParser, extractGeminiText } from '../../src/ai/infrastructure/ai-stream';

const chunk = (text: string) =>
  `data: {"candidates":[{"content":{"parts":[{"text":${JSON.stringify(text)}}]}}]}\n\n`;

describe('extractGeminiText', () => {
  it('extracts text with unknown guards', () => {
    expect(
      extractGeminiText({
        candidates: [{ content: { parts: [{ text: 'hola' }, { text: ' mundo' }] } }],
      })
    ).toBe('hola mundo');
    expect(extractGeminiText(null)).toBe('');
    expect(extractGeminiText({})).toBe('');
    expect(extractGeminiText({ candidates: [{ content: {} }] })).toBe('');
    expect(extractGeminiText({ candidates: [{ content: { parts: [{ no: 1 }] } }] })).toBe('');
  });
});

describe('createSseParser', () => {
  it('emits tokens from complete events', () => {
    const onToken = vi.fn();
    const parser = createSseParser(onToken);
    parser.feed(chunk('Hola') + chunk(' mundo'));
    parser.flush();
    expect(onToken).toHaveBeenNthCalledWith(1, 'Hola');
    expect(onToken).toHaveBeenNthCalledWith(2, ' mundo');
  });

  it('reassembles JSON split across chunks', () => {
    const onToken = vi.fn();
    const parser = createSseParser(onToken);
    const full = chunk('riega cada 7 días');
    parser.feed(full.slice(0, 25));
    parser.feed(full.slice(25));
    parser.flush();
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('riega cada 7 días');
  });

  it('ignores [DONE], empty lines and non-data lines', () => {
    const onToken = vi.fn();
    const parser = createSseParser(onToken);
    parser.feed(': ping\n\ndata: [DONE]\n\ndata:   \n\n' + chunk('ok'));
    parser.flush();
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('ok');
  });

  it('discards truncated tail on flush without throwing', () => {
    const onToken = vi.fn();
    const parser = createSseParser(onToken);
    parser.feed('data: {"candidates":[{');
    expect(() => parser.flush()).not.toThrow();
    expect(onToken).not.toHaveBeenCalled();
  });
});
