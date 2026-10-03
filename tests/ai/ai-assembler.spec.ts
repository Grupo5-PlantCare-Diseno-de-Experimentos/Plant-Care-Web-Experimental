import { describe, expect, it } from 'vitest';
import { AiAssembler } from '../../src/ai/infrastructure/ai-assembler';
import {
  assertAiReply,
  createUserMessage,
  isAiReply,
} from '../../src/ai/domain/model/ai.entity.ts';

describe('AiAssembler', () => {
  it('maps conversation row snake_case to domain', () => {
    const domain = AiAssembler.conversationToDomain({
      id: 'c1',
      user_id: 'u1',
      plant_id: 7,
      title: 'Riego',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(domain).toEqual({
      id: 'c1',
      userId: 'u1',
      plantId: 7,
      title: 'Riego',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('maps message row and normalizes unknown role to user', () => {
    const domain = AiAssembler.messageToDomain({
      id: 'm1',
      conversation_id: 'c1',
      role: 'system',
      content: 'hola',
      model: 'gemini-2.5-flash',
      prompt_tokens: '12',
      response_tokens: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(domain.role).toBe('user');
    expect(domain.promptTokens).toBe(12);
    expect(domain.responseTokens).toBeNull();
  });

  it('builds aggregated prompt context without raw series', () => {
    const ctx = AiAssembler.buildPromptContext({
      plants: [
        {
          id: 1,
          name: 'Monstera',
          type: 'interior',
          status: 'warning',
          lastWatered: '2026-01-01',
          nextWatering: '2026-01-03',
        },
      ],
      healthScore: 62,
      avgHumidity: 48,
    });
    expect(ctx?.totalPlants).toBe(1);
    expect(ctx?.healthScore).toBe(62);
    expect(ctx).not.toHaveProperty('metrics');
  });

  it('returns null context when no plants', () => {
    expect(AiAssembler.buildPromptContext({ plants: [] })).toBeNull();
  });
});

describe('ai entity guards', () => {
  it('validates AiReply with unknown input', () => {
    expect(isAiReply({ reply: 'hola', model: 'gemini-2.5-flash' })).toBe(true);
    expect(isAiReply({ reply: 123, model: 'x' })).toBe(false);
    expect(() => assertAiReply({ nope: true })).toThrow();
  });

  it('creates user message payload', () => {
    const msg = createUserMessage('¿Riego?', 'c1');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('¿Riego?');
  });
});
