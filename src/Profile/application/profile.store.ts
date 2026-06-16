import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserProfile, UserAchievement, AchievementsResponse, ProfileUpdateRequest } from '../model/profile.entity';
import { profileService } from '../infrastructure/profile.service';

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

/** Prefijo de la clave en localStorage que registra los logros ya notificados por usuario. */
const SEEN_ACHIEVEMENTS_KEY = 'pc:seenAchievements:';

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile | null>(null);
  const achievements = ref<UserAchievement[]>([]);
  /** Logros recién desbloqueados (no notificados antes) para que la UI emita una notificación. */
  const newAchievements = ref<UserAchievement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchProfile = async () => {
    loading.value = true;
    error.value = null;
    try {
      const userProfile = await profileService.getProfile();
      profile.value = userProfile;
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Error al cargar el perfil');
      profile.value = null;
    } finally {
      loading.value = false;
    }
  };

  const fetchAchievements = async () => {
    try {
      const response: AchievementsResponse = await profileService.getAchievements();
      const list = response.achievements || [];
      achievements.value = list;
      detectNewlyUnlocked(list);
    } catch {
      achievements.value = [];
    }
  };

  /**
   * Compara los logros desbloqueados contra el registro local de "ya vistos"
   * (por usuario) y publica los nuevos en `newAchievements` para notificarlos.
   * En la primera carga del usuario inicializa el registro sin notificar, para
   * no disparar una avalancha de avisos de logros antiguos.
   */
  const detectNewlyUnlocked = (list: UserAchievement[]) => {
    const userId = localStorage.getItem('userUuid');
    if (!userId) return;

    const key = SEEN_ACHIEVEMENTS_KEY + userId;
    const unlockedIds = list.filter((a) => a.status === 'unlocked').map((a) => a.id);
    const raw = localStorage.getItem(key);

    if (raw === null) {
      localStorage.setItem(key, JSON.stringify(unlockedIds));
      return;
    }

    let seen: string[] = [];
    try {
      seen = JSON.parse(raw);
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    const fresh = list.filter((a) => a.status === 'unlocked' && !seenSet.has(a.id));
    if (fresh.length > 0) {
      newAchievements.value = fresh;
    }
    localStorage.setItem(key, JSON.stringify(unlockedIds));
  };

  /** Limpia la cola de logros nuevos una vez que la UI los ha notificado. */
  const clearNewAchievements = () => {
    newAchievements.value = [];
  };

  const updateProfile = async (data: ProfileUpdateRequest) => {
    try {
      const updated = await profileService.updateProfile(data);
      profile.value = updated;
      return updated;
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Error al actualizar el perfil');
      throw e;
    }
  };

  const uploadAvatar = async (file: File) => {
    try {
      const response = await profileService.uploadAvatar(file);
      if (profile.value) {
        profile.value.avatarUrl = response.avatarUrl;
      }
      return response;
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Error al cargar el avatar');
      throw e;
    }
  };

  const setError = (message: string) => {
    error.value = message;
  };

  return {
    profile,
    achievements,
    newAchievements,
    loading,
    error,
    fetchProfile,
    fetchAchievements,
    clearNewAchievements,
    updateProfile,
    uploadAvatar,
    setError,
    $reset: () => {
      profile.value = null;
      achievements.value = [];
      newAchievements.value = [];
      loading.value = false;
      error.value = null;
    }
  };
});
