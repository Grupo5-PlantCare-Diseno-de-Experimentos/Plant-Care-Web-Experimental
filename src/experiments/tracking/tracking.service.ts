import { supabase } from '../../utils/supabase';

/**
 * Eventos del Tracking Plan (Capítulo VIII, 8.2.8).
 * Se alinean con los nombres estándar de Google Analytics 4.
 */
export type TrackingEventName =
  | 'select_promotion'
  | 'view_promotion'
  | 'purchase_simulation'
  | 'click_alert_link'
  | 'dashboard_view';

export interface TrackingEvent {
  eventName: TrackingEventName;
  promotionId?: string;
  promotionName?: string;
  location?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

type FeatureInteractionRow = {
  user_id: string;
  event_name: string;
  promotion_id: string | null;
  promotion_name: string | null;
  location: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

/**
 * Servicio de seguimiento de interacciones.
 *
 * Aplica el principio de economía de datos (8.2.3): los eventos NO se envían de
 * forma individual e inmediata, sino que se consolidan en un buffer local y se
 * transmiten en un único paquete (batch) cuando el usuario abandona la página o
 * cierra la sesión. Esto reduce la carga de peticiones HTTP al backend.
 *
 * Cada evento se replica además a Google Analytics (window.gtag) si está
 * disponible, sin acoplar la aplicación a su carga.
 */
class TrackingService {
  private buffer: TrackingEvent[] = [];
  private listenersBound = false;

  /** Registra un evento en el buffer y lo replica a GA si existe. */
  track(event: Omit<TrackingEvent, 'occurredAt'> & { occurredAt?: string }): void {
    const fullEvent: TrackingEvent = {
      ...event,
      occurredAt: event.occurredAt || new Date().toISOString(),
    };

    this.buffer.push(fullEvent);
    this.sendToGoogleAnalytics(fullEvent);
    this.bindFlushListeners();
  }

  /** Replica el evento a Google Analytics 4 si gtag está cargado. */
  private sendToGoogleAnalytics(event: TrackingEvent): void {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;

    gtag('event', event.eventName, {
      promotion_id: event.promotionId,
      promotion_name: event.promotionName,
      location: event.location,
      ...event.metadata,
    });
  }

  /** Vincula el flush automático al abandonar la página (una sola vez). */
  private bindFlushListeners(): void {
    if (this.listenersBound || typeof window === 'undefined') return;
    this.listenersBound = true;

    const flushHandler = () => { void this.flush(); };
    window.addEventListener('pagehide', flushHandler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushHandler();
    });
  }

  /**
   * Vacía el buffer hacia Supabase en una sola inserción por lotes.
   * Es seguro llamarlo en cualquier momento (p. ej. antes de cerrar sesión).
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Sin usuario autenticado no podemos cumplir la RLS; descartamos el buffer.
      this.buffer = [];
      return;
    }

    const pending = this.buffer.splice(0, this.buffer.length);
    const rows: FeatureInteractionRow[] = pending.map((e) => ({
      user_id: user.id,
      event_name: e.eventName,
      promotion_id: e.promotionId ?? null,
      promotion_name: e.promotionName ?? null,
      location: e.location ?? null,
      metadata: e.metadata ?? null,
      occurred_at: e.occurredAt,
    }));

    const { error } = await supabase.from('feature_interaction_logs').insert(rows);
    if (error) {
      // Si falla, reencolamos para reintentar en el próximo flush.
      this.buffer.unshift(...pending);
      console.warn('[Tracking] No se pudo enviar el lote de eventos:', error.message);
    }
  }
}

export const trackingService = new TrackingService();
