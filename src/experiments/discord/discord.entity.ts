/**
 * Dominio de las alertas de riego crítico vía Discord (US-041 / EC-01).
 */

/** Umbral de humedad del suelo que dispara el estado crítico (≤ 20%). */
export const CRITICAL_SOIL_MOISTURE = 20;

/** Umbral de humedad que restablece el estado a normal tras el riego (> 30%). */
export const RECOVERY_SOIL_MOISTURE = 30;

/**
 * Patrón de validación oficial de webhooks de Discord (Regla de Negocio US-041).
 * Acepta los dominios discord.com y discordapp.com.
 */
export const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhook(url: string): boolean {
  return DISCORD_WEBHOOK_REGEX.test(url.trim());
}

export interface CriticalAlertContext {
  plantId: number;
  plantName: string;
  soilMoisturePct: number;
  temperatureC?: number | null;
  /** URL base de la app para construir el enlace de diagnóstico. */
  appBaseUrl: string;
}

/**
 * Determina la causa probable del estado crítico para enriquecer la alerta.
 * Cumple con el "diagnóstico contextual" exigido por la hipótesis de EC-01.
 */
export function probableCause(ctx: CriticalAlertContext): string {
  if (ctx.temperatureC != null && ctx.temperatureC >= 30) {
    return 'Posible exceso de calor acelerando la evaporación del sustrato.';
  }
  if (ctx.soilMoisturePct <= 10) {
    return 'Drenaje rápido o riego insuficiente: sustrato prácticamente seco.';
  }
  return 'La humedad del suelo cayó por debajo del nivel seguro de riego.';
}

/**
 * Construye el payload de la tarjeta enriquecida (embed) de Discord.
 * Incluye el enlace parametrizado con utm_source=discord (medida secundaria EC-01).
 */
export function buildCriticalAlertPayload(ctx: CriticalAlertContext): Record<string, unknown> {
  const diagnosisUrl =
    `${ctx.appBaseUrl.replace(/\/$/, '')}/plants/${ctx.plantId}?utm_source=discord`;

  return {
    content: '🚨 **Alerta de riego crítico**',
    embeds: [
      {
        title: `${ctx.plantName} necesita riego`,
        description: probableCause(ctx),
        color: 0xe53935,
        fields: [
          {
            name: '💧 Humedad del suelo',
            value: `${ctx.soilMoisturePct}%`,
            inline: true,
          },
          ...(ctx.temperatureC != null
            ? [{ name: '🌡️ Temperatura', value: `${ctx.temperatureC}°C`, inline: true }]
            : []),
          {
            name: '🔗 Diagnóstico',
            value: `[Abrir diagnóstico de salud](${diagnosisUrl})`,
            inline: false,
          },
        ],
        footer: { text: 'PlantCare · Alerta automática' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
