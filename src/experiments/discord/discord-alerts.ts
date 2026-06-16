import { discordWebhookService } from './discord-webhook.service';
import {
  CRITICAL_SOIL_MOISTURE,
  RECOVERY_SOIL_MOISTURE,
  type CriticalAlertContext,
} from './discord.entity';

/**
 * Control de frecuencia por transición de estado (8.2.3 — economía de datos).
 *
 * Una alerta SOLO se dispara cuando el estado de la planta cambia de "Óptimo"
 * a "Crítico". Las notificaciones subsiguientes quedan suspendidas hasta que se
 * registre un riego que retorne la humedad por encima del 30%.
 *
 * El estado se persiste por planta en localStorage para sobrevivir recargas.
 */
type AlertState = 'normal' | 'critical';

const stateKey = (plantId: number) => `pc_discord_alert_${plantId}`;

function getState(plantId: number): AlertState {
  return localStorage.getItem(stateKey(plantId)) === 'critical' ? 'critical' : 'normal';
}

function setState(plantId: number, state: AlertState): void {
  localStorage.setItem(stateKey(plantId), state);
}

/**
 * Reinicia el estado de alerta de una planta tras un riego (humedad recuperada).
 * Debe llamarse cuando el usuario registra un riego.
 */
export function resetAlertState(plantId: number): void {
  setState(plantId, 'normal');
}

interface EvaluateParams {
  plantId: number;
  plantName: string;
  soilMoisturePct: number | null;
  temperatureC?: number | null;
}

/**
 * Evalúa la última lectura de una planta y envía la alerta de Discord si
 * corresponde a una transición Óptimo → Crítico. Devuelve true si se envió.
 *
 * No lanza errores hacia el llamador: el monitoreo no debe romper la UI.
 */
export async function evaluateCriticalAlert(params: EvaluateParams): Promise<boolean> {
  const { plantId, plantName, soilMoisturePct, temperatureC } = params;
  if (soilMoisturePct == null) return false;

  // Recuperación: si el suelo superó el umbral de recuperación, rearmamos la alerta.
  if (soilMoisturePct > RECOVERY_SOIL_MOISTURE) {
    setState(plantId, 'normal');
    return false;
  }

  // Sólo nos interesa el rango crítico.
  if (soilMoisturePct > CRITICAL_SOIL_MOISTURE) return false;

  // Anti-spam: ya estábamos en crítico, no reenviamos.
  if (getState(plantId) === 'critical') return false;

  try {
    const webhookUrl = await discordWebhookService.getWebhookUrl();
    if (!webhookUrl) return false;

    const ctx: CriticalAlertContext = {
      plantId,
      plantName,
      soilMoisturePct,
      temperatureC,
      appBaseUrl: window.location.origin,
    };

    await discordWebhookService.sendCriticalAlert(webhookUrl, ctx);
    setState(plantId, 'critical');
    return true;
  } catch (e) {
    console.warn('[DiscordAlerts] No se pudo enviar la alerta crítica:', e);
    return false;
  }
}
