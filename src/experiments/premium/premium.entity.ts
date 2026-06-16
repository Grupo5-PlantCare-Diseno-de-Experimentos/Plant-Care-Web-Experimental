/**
 * Dominio de la valoración de características premium (US-042 / EC-02).
 */

/** Identificador de la característica origen del interés. */
export type PremiumFeatureId = 'premium_health' | 'premium_history';

export interface PremiumPromotion {
  /** promotion_id del Tracking Plan (8.2.8). */
  promotionId: PremiumFeatureId;
  /** promotion_name del Tracking Plan (8.2.8). */
  promotionName: string;
  /** Ubicación lógica del botón. */
  location: string;
  /** id del elemento <a> en el DOM, según el plan de seguimiento. */
  anchorId: string;
}

/** Catálogo de promociones alineado con el Tracking Plan 8.2.8. */
export const PREMIUM_PROMOTIONS: Record<PremiumFeatureId, PremiumPromotion> = {
  premium_health: {
    promotionId: 'premium_health',
    promotionName: 'diagnostico_avanzado',
    location: 'panel_salud',
    anchorId: 'btn-premium-health',
  },
  premium_history: {
    promotionId: 'premium_history',
    promotionName: 'retencion_datos_24m',
    location: 'panel_historial',
    anchorId: 'btn-premium-history',
  },
};

/** Identificador del plan simulado para el evento purchase_simulation. */
export const SIMULATED_PLAN_ID = 'suscripcion_premium_mensual';
