import { supabase } from '../../utils/supabase';
import type {
	UserProfile,
	ProfileUpdateRequest,
	AvatarUploadResponse,
	UserStats,
	AchievementsResponse,
	UserAchievement,
} from '../model/profile.entity';
import {
	computeExpertCaretakerStreak,
	EXPERT_ACHIEVEMENT_ID,
	EXPERT_STREAK_DAYS,
} from '../../experiments/gamification/expert-caretaker';

type AuthenticatedUser = {
	id: string;
	email?: string;
	created_at: string;
};

type ProfileRow = {
	full_name?: string | null;
	phone?: string | null;
	bio?: string | null;
	location?: string | null;
	avatar_url?: string | null;
	join_date?: string | null;
};

type ProfilePersistence = {
	full_name?: string;
	phone?: string;
	bio?: string;
	location?: string;
};

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
};

class ProfileService {
	private async getAuthenticatedUser(): Promise<AuthenticatedUser> {
		const { data: { user }, error } = await supabase.auth.getUser();
		if (error || !user) throw new Error('User not authenticated');
		return user;
	}

	private async getUserId(): Promise<string> {
		const user = await this.getAuthenticatedUser();
		return user.id;
	}

	async getProfile(): Promise<UserProfile> {
		const user = await this.getAuthenticatedUser();
		
		// Get profile details
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', user.id)
			.maybeSingle();

		if (error) {
			throw error;
		}

		const profileData = (data || {}) as ProfileRow;
		
		// Calculate stats from actual data
		const stats = await this.calculateStats(user.id);

		return {
			email: user.email || '',
			username: user.email?.split('@')[0] || 'user',
			fullName: profileData.full_name || '',
			phone: profileData.phone || '',
			bio: profileData.bio || '',
			location: profileData.location || '',
			avatarUrl: profileData.avatar_url || '',
			joinDate: profileData.join_date || user.created_at,
			stats: stats
		};
	}

	private async calculateStats(userId: string): Promise<UserStats> {
		try {
			// Count total plants
			const { data: plants, error: plantsError } = await supabase
				.from('plants')
				.select('id, status', { count: 'exact' })
				.eq('user_id', userId);

			if (plantsError) throw plantsError;
			const totalPlants = plants?.length || 0;

			if (totalPlants === 0) {
				return { totalPlants: 0, wateringSessions: 0, successRate: 100 };
			}

			// Count watering logs (sessions)
			const { count: wateringSessions, error: logsError } = await supabase
				.from('watering_logs')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', userId);

			if (logsError) throw logsError;

			// Calculate success rate: percentage of plants in healthy status
			let successRate = 100;
			if (plants && plants.length > 0) {
				const healthyCount = plants.filter(p => p.status === 'healthy').length;
				successRate = Math.round((healthyCount / plants.length) * 100);
			}

			return {
				totalPlants,
				wateringSessions: wateringSessions || 0,
				successRate
			};
		} catch {
			return { totalPlants: 0, wateringSessions: 0, successRate: 100 };
		}
	}

	async updateProfile(data: ProfileUpdateRequest): Promise<UserProfile> {
		const userId = await this.getUserId();
		
		const updateData = toPersistence(data);

		const { error } = await supabase
			.from('profiles')
			.upsert({ id: userId, ...updateData });

		if (error) throw error;
		
		return this.getProfile();
	}

	async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
		const userId = await this.getUserId();
		const fileExt = validateAvatar(file);
		const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
		
		// Note: Requires a storage bucket named 'avatars'
		const { error: uploadError } = await supabase.storage
			.from(AVATAR_BUCKET)
			.upload(filePath, file);

		if (uploadError) throw uploadError;

		const { data: { publicUrl } } = supabase.storage
			.from(AVATAR_BUCKET)
			.getPublicUrl(filePath);
		
		const { error: updateError } = await supabase
			.from('profiles')
			.upsert({ id: userId, avatar_url: publicUrl });
			
		if (updateError) throw updateError;

		return { avatarUrl: publicUrl };
	}

	async getStats(): Promise<UserStats> {
		const userId = await this.getUserId();
		return this.calculateStats(userId);
	}

	/**
	 * Sistema de gamificación (Capítulo VIII): calcula logros desbloqueables a
	 * partir de los datos reales del usuario (plantas, sesiones de riego y rachas
	 * de salud), sin requerir una tabla adicional.
	 */
	async getAchievements(): Promise<AchievementsResponse> {
		const user = await this.getAuthenticatedUser();
		const stats = await this.calculateStats(user.id);
		const now = new Date().toISOString();

		const definitions: Array<{
			id: string;
			titleKey: string;
			descKey: string;
			icon: string;
			unlocked: boolean;
		}> = [
			{
				id: 'first_plant',
				titleKey: 'profile.achievementsList.firstPlant.title',
				descKey: 'profile.achievementsList.firstPlant.desc',
				icon: '🌱',
				unlocked: stats.totalPlants >= 1,
			},
			{
				id: 'plant_collector',
				titleKey: 'profile.achievementsList.collector.title',
				descKey: 'profile.achievementsList.collector.desc',
				icon: '🪴',
				unlocked: stats.totalPlants >= 5,
			},
			{
				id: 'hydration_hero',
				titleKey: 'profile.achievementsList.hydrationHero.title',
				descKey: 'profile.achievementsList.hydrationHero.desc',
				icon: '💧',
				unlocked: stats.wateringSessions >= 10,
			},
			{
				id: 'consistent_carer',
				titleKey: 'profile.achievementsList.consistentCarer.title',
				descKey: 'profile.achievementsList.consistentCarer.desc',
				icon: '🏅',
				unlocked: stats.wateringSessions >= 50,
			},
			{
				id: 'healthy_streak',
				titleKey: 'profile.achievementsList.healthyStreak.title',
				descKey: 'profile.achievementsList.healthyStreak.desc',
				icon: '🌟',
				unlocked: stats.totalPlants > 0 && stats.successRate === 100,
			},
		];

		const achievements: UserAchievement[] = definitions.map((d) => ({
			id: d.id,
			title: d.id,
			description: '',
			titleKey: d.titleKey,
			descKey: d.descKey,
			icon: d.icon,
			earnedDate: d.unlocked ? now : null,
			status: (d.unlocked ? 'unlocked' : 'locked') as 'unlocked' | 'locked',
		}));

		// Insignia destacada "Cuidador Experto" (Hipótesis 5 — racha de 7 días).
		const expertBadge = await this.computeExpertCaretakerBadge(user.id);
		return { achievements: [expertBadge, ...achievements] };
	}

	/**
	 * Calcula la insignia destacada "Cuidador Experto" y persiste su desbloqueo
	 * la primera vez que se cumple la racha (para conservar la fecha real).
	 */
	private async computeExpertCaretakerBadge(userId: string): Promise<UserAchievement> {
		const { streakDays, unlocked } = await computeExpertCaretakerStreak(userId);

		let earnedDate = await this.getPersistedUnlock(userId, EXPERT_ACHIEVEMENT_ID);
		if (unlocked && !earnedDate) {
			earnedDate = await this.persistUnlock(userId, EXPERT_ACHIEVEMENT_ID);
		}

		const isUnlocked = unlocked || earnedDate !== null;

		return {
			id: EXPERT_ACHIEVEMENT_ID,
			title: EXPERT_ACHIEVEMENT_ID,
			description: '',
			titleKey: 'profile.achievementsList.expertCaretaker.title',
			descKey: 'profile.achievementsList.expertCaretaker.desc',
			icon: '🏆',
			earnedDate,
			status: isUnlocked ? 'unlocked' : 'locked',
			featured: true,
			progress: Math.min(streakDays / EXPERT_STREAK_DAYS, 1),
		};
	}

	/** Lee la fecha de desbloqueo persistida de un logro, o null. */
	private async getPersistedUnlock(userId: string, achievementId: string): Promise<string | null> {
		const { data, error } = await supabase
			.from('user_achievements')
			.select('unlocked_at')
			.eq('user_id', userId)
			.eq('achievement_id', achievementId)
			.maybeSingle();

		if (error) return null;
		return (data?.unlocked_at as string | null) ?? null;
	}

	/** Persiste el desbloqueo de un logro y devuelve su timestamp. */
	private async persistUnlock(userId: string, achievementId: string): Promise<string> {
		const unlockedAt = new Date().toISOString();
		const { error } = await supabase
			.from('user_achievements')
			.upsert(
				{ user_id: userId, achievement_id: achievementId, unlocked_at: unlockedAt },
				{ onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
			);

		// Si falla la persistencia, devolvemos igualmente la fecha calculada.
		if (error) console.warn('[Achievements] No se pudo persistir el desbloqueo:', error.message);
		return unlockedAt;
	}

	async createProfile(userId: string): Promise<UserProfile> {
		const newProfileData = {
			id: userId,
			full_name: null,
			phone: null,
			bio: null,
			location: null,
			avatar_url: null,
			join_date: new Date().toISOString(),
			stats: {
				successRate: 100,
				totalPlants: 0,
				wateringSessions: 0
			}
		};

		const { error } = await supabase
			.from('profiles')
			.insert([newProfileData]);

		if (error && error.code !== '23505') { // 23505 is duplicate key error, which is fine if profile already exists
			throw error;
		}

		// Return the created profile
		return {
			email: '',
			username: `user_${userId.substring(0, 8)}`,
			fullName: '',
			phone: '',
			bio: '',
			location: '',
			avatarUrl: '',
			joinDate: newProfileData.join_date,
			stats: newProfileData.stats as UserStats
		};
	}
}

export const profileService = new ProfileService();

function toPersistence(data: ProfileUpdateRequest): ProfilePersistence {
	const updateData: ProfilePersistence = {};
	if (data.fullName !== undefined) updateData.full_name = data.fullName.trim();
	if (data.phone !== undefined) updateData.phone = data.phone.trim();
	if (data.bio !== undefined) updateData.bio = data.bio.trim();
	if (data.location !== undefined) updateData.location = data.location.trim();
	return updateData;
}

function validateAvatar(file: File): string {
	const extension = AVATAR_EXTENSIONS[file.type];
	if (!extension) {
		throw new Error('Unsupported avatar file type');
	}

	if (file.size > MAX_AVATAR_SIZE_BYTES) {
		throw new Error('Avatar file is too large');
	}

	return extension;
}
