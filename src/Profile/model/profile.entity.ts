export interface UserStats {
    totalPlants: number;
    wateringSessions: number;
    successRate: number;
}

export interface UserAchievement {
    id: string;
    title: string;
    description: string;
    /** Clave i18n opcional para traducir el título en la presentación. */
    titleKey?: string;
    /** Clave i18n opcional para traducir la descripción en la presentación. */
    descKey?: string;
    icon: string;
    earnedDate: string | null;
    status: 'locked' | 'unlocked';
    /** Insignia destacada (hero) que se muestra de forma prominente en el perfil. */
    featured?: boolean;
    /** Progreso 0..1 hacia el desbloqueo (para insignias por racha). */
    progress?: number;
}

export interface UserProfile {
    email: string;
    username: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    bio?: string;
    location?: string;
    avatarUrl?: string;
    joinDate: string;
    lastLogin?: string;
    stats: UserStats;
}

export interface ProfileUpdateRequest {
    fullName?: string;
    phone?: string;
    bio?: string;
    location?: string;
}

export interface AvatarUploadResponse {
    avatarUrl: string;
}

export interface ValidationError {
    error: string;
    message: string;
    details: Record<string, string>;
}

export interface AchievementsResponse {
    achievements: UserAchievement[];
}
