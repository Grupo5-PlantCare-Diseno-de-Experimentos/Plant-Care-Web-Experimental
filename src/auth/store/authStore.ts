import { SupabaseAuthAdapter } from '../adapters/SupabaseAuthAdapter';
import { profileService } from '../../profile/infrastructure/profile.service';
import { setupAuthStore } from './authStoreFactory';

const authAdapter = new SupabaseAuthAdapter();

// Inject dependencies into the store factory
export const useAuthStore = setupAuthStore(authAdapter, profileService);
