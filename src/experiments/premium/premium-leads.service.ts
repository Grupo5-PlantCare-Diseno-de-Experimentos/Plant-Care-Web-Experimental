import { supabase } from '../../utils/supabase';
import { SIMULATED_PLAN_ID, type PremiumFeatureId } from './premium.entity';

/**
 * Servicio que registra el interés de compra simulado (US-042 / EC-02).
 * Inserta una fila en la tabla `premium_leads` sin realizar ningún cobro real.
 */
class PremiumLeadsService {
  async registerLead(sourceFeature: PremiumFeatureId): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');

    const { error } = await supabase.from('premium_leads').insert({
      user_id: user.id,
      plan_id: SIMULATED_PLAN_ID,
      source_feature: sourceFeature,
      simulated: true,
    });

    if (error) throw error;
  }
}

export const premiumLeadsService = new PremiumLeadsService();
