import { supabase } from '../../utils/supabase';
import {
  isValidDiscordWebhook,
  buildCriticalAlertPayload,
  type CriticalAlertContext,
} from './discord.entity';

/**
 * Servicio de integración con webhooks de Discord (US-041 / EC-01).
 * Realiza las peticiones HTTP POST directamente desde el cliente.
 */
class DiscordWebhookService {
  /** Devuelve la URL del webhook almacenada en el perfil del usuario, o null. */
  async getWebhookUrl(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('discord_webhook_url')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return (data?.discord_webhook_url as string | null) ?? null;
  }

  /**
   * Vincula un canal de Discord: valida la URL, la persiste en el perfil y
   * envía un mensaje de confirmación al canal (Escenario 01 de US-041).
   */
  async linkWebhook(url: string): Promise<void> {
    const trimmed = url.trim();
    if (!isValidDiscordWebhook(trimmed)) {
      throw new Error('INVALID_WEBHOOK_URL');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, discord_webhook_url: trimmed });

    if (error) throw error;

    await this.post(trimmed, {
      content: '✅ **PlantCare** vinculó este canal correctamente. Recibirás aquí las alertas de riego crítico.',
    });
  }

  /** Elimina la vinculación del webhook. */
  async unlinkWebhook(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, discord_webhook_url: null });

    if (error) throw error;
  }

  /** Envía la alerta enriquecida de riego crítico al canal vinculado. */
  async sendCriticalAlert(webhookUrl: string, ctx: CriticalAlertContext): Promise<void> {
    await this.post(webhookUrl, buildCriticalAlertPayload(ctx));
  }

  /** Realiza la petición POST al webhook de Discord. */
  private async post(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Discord responde 204 No Content cuando el envío es exitoso.
    if (!response.ok && response.status !== 204) {
      throw new Error(`DISCORD_POST_FAILED_${response.status}`);
    }
  }
}

export const discordWebhookService = new DiscordWebhookService();
