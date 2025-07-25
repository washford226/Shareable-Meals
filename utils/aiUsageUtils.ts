import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  profile_picture?: Uint8Array;
  calories_goal?: number;
  protein_goal?: number;
  carbohydrates_goal?: number;
  fat_goal?: number;
  dietary_restrictions?: string;
  allergies?: string;
  created_at?: string;
  is_admin: boolean;
  ban: boolean;
  ai_usage_count: number;
  ai_usage_last_date?: string;
  scanner_usage_count: number;
  scanner_usage_last_date?: string;
}

export interface ScannerUsageResult {
  canUse: boolean;
  remainingUses: number;
  message?: string;
}

const SCANNER_DAILY_LIMIT = 3;

/**
 * Check if user can use scanner and track usage
 */
export const checkScannerUsage = async (): Promise<ScannerUsageResult> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('scanner_usage_count, scanner_usage_last_date')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    const lastUsageDate = profile?.scanner_usage_last_date;
    const currentUsageCount = profile?.scanner_usage_count || 0;

    // Reset usage count if it's a new day
    if (lastUsageDate !== today) {
      return {
        canUse: true,
        remainingUses: SCANNER_DAILY_LIMIT - 1, // -1 because this use will be counted
        message: undefined
      };
    }

    // Check if user has exceeded daily limit
    if (currentUsageCount >= SCANNER_DAILY_LIMIT) {
      return {
        canUse: false,
        remainingUses: 0,
        message: `You have reached your daily scanner limit of ${SCANNER_DAILY_LIMIT} uses. Please try again tomorrow.`
      };
    }

    return {
      canUse: true,
      remainingUses: SCANNER_DAILY_LIMIT - currentUsageCount - 1, // -1 because this use will be counted
      message: undefined
    };

  } catch (error) {
    console.error('Error checking scanner usage:', error);
    return {
      canUse: false,
      remainingUses: 0,
      message: 'Failed to check scanner usage. Please try again.'
    };
  }
};

/**
 * Increment scanner usage count
 */
export const incrementScannerUsage = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const today = new Date().toISOString().split('T')[0];

    // Get current usage
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('scanner_usage_count, scanner_usage_last_date')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const lastUsageDate = profile?.scanner_usage_last_date;
    const currentUsageCount = profile?.scanner_usage_count || 0;

    // Determine new usage count
    let newUsageCount: number;
    if (lastUsageDate !== today) {
      // New day, reset to 1
      newUsageCount = 1;
    } else {
      // Same day, increment
      newUsageCount = currentUsageCount + 1;
    }

    // Update usage count and date
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        scanner_usage_count: newUsageCount,
        scanner_usage_last_date: today
      })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Scanner usage incremented to ${newUsageCount} for ${today}`);
    return true;

  } catch (error) {
    console.error('Error incrementing scanner usage:', error);
    return false;
  }
};

/**
 * Get current scanner usage for display
 */
export const getScannerUsageStatus = async (): Promise<{ used: number; remaining: number; total: number } | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('scanner_usage_count, scanner_usage_last_date')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastUsageDate = profile?.scanner_usage_last_date;
    const currentUsageCount = profile?.scanner_usage_count || 0;

    // If it's a new day, usage count should be 0
    const usedToday = lastUsageDate === today ? currentUsageCount : 0;
    const remaining = Math.max(0, SCANNER_DAILY_LIMIT - usedToday);

    return {
      used: usedToday,
      remaining: remaining,
      total: SCANNER_DAILY_LIMIT
    };

  } catch (error) {
    console.error('Error getting scanner usage status:', error);
    return null;
  }
};
