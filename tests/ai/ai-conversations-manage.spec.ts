import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../src/utils/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '../../src/utils/supabase';
import { AiService } from '../../src/ai/infrastructure/ai.service';
import { useAiStore } from '../../src/ai/application/ai.store';

const service = new AiService();

const convRow = (overrides = {}) => ({
  id: 'conv-1',
  user_id: 'user-1',
  plant_id: null,
  title: 'Riego Monstera',
  created_at: new Date().toISOString(),
  ...overrides,
});

const mockDeleteOk = () => {
  vi.mocked(supabase.from).mockReturnValue({
    delete: () => ({ eq: async () => ({ error: null }) }),
  } as never);
};

const mockRenameOk = (title: string) => {
  vi.mocked(supabase.from).mockReturnValue({
    update: () => ({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: convRow({ title }), error: null }),
        }),
      }),
    }),
  } as never);
};

describe('AiService.manageConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteConversation rechaza ids vacíos sin tocar Supabase', async () => {
    await expect(service.deleteConversation('')).rejects.toThrow('Invalid conversationId');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('deleteConversation borra por id', async () => {
    mockDeleteOk();
    await expect(service.deleteConversation('conv-1')).resolves.toMatchObject({ data: null });
    expect(supabase.from).toHaveBeenCalledWith('ai_conversations');
  });

  it('renameConversation rechaza títulos vacíos', async () => {
    await expect(service.renameConversation('conv-1', '   ')).rejects.toThrow('Invalid title');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('renameConversation recorta a 120 caracteres', async () => {
    const long = `x`.repeat(200);
    mockRenameOk(long.slice(0, 120));
    const res = await service.renameConversation('conv-1', long);
    expect(res.data.title).toHaveLength(120);
  });
});

describe('useAiStore.delete+rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('deleteConversation filtra local y limpia la activa', async () => {
    mockDeleteOk();
    const store = useAiStore();
    store.conversations = [convRow({ id: 'a' }), convRow({ id: 'b', title: 'Otro' })] as never;
    store.activeConversationId = 'a';
    store.messages = [{ id: 'm1' }] as never;

    await store.deleteConversation('a');

    expect(store.conversations.map((c) => c.id)).toEqual(['b']);
    expect(store.activeConversationId).toBeNull();
    expect(store.messages).toEqual([]);
  });

  it('renameConversation actualiza el título local', async () => {
    mockRenameOk('Nuevo nombre');
    const store = useAiStore();
    store.conversations = [convRow({ id: 'a' })] as never;

    await store.renameConversation('a', '  Nuevo nombre  ');

    expect(store.conversations[0].title).toBe('Nuevo nombre');
  });

  it('renameConversation con título vacío fija error sin llamar a Supabase', async () => {
    const store = useAiStore();
    store.conversations = [convRow({ id: 'a' })] as never;

    await store.renameConversation('a', '   ');

    expect(supabase.from).not.toHaveBeenCalled();
    expect(store.error).toBeTruthy();
    expect(store.conversations[0].title).toBe('Riego Monstera');
  });
});
