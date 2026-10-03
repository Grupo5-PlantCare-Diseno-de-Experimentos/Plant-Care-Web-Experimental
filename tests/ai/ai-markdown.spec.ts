import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from '../../src/ai/infrastructure/ai-markdown';

describe('renderSafeMarkdown', () => {
  it('renders headings and lists', () => {
    const html = renderSafeMarkdown('# Riego\n\n- cada 7 días\n- suelo < 30%');
    expect(html).toContain('<h1>');
    expect(html).toContain('<li>');
    expect(html).toContain('Riego');
  });

  it('strips scripts and event handlers', () => {
    const html = renderSafeMarkdown(
      'hola <script>alert(1)</script> <img src="x" onerror="alert(2)">'
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
    expect(html).toContain('hola');
  });

  it('strips javascript: links', () => {
    const html = renderSafeMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('returns empty string for empty input', () => {
    expect(renderSafeMarkdown('')).toBe('');
  });
});
