import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const AI_USAGE_KEY = 'ai_meal_usage';
const MAX_DAILY_AI_CREATIONS = 5;

export interface AIUsageData {
  date: string;
  count: number;
}

export class AIUsageTracker {
  private static instance: AIUsageTracker;

  static getInstance(): AIUsageTracker {
    if (!AIUsageTracker.instance) {
      AIUsageTracker.instance = new AIUsageTracker();
    }
    return AIUsageTracker.instance;
  }

  private getTodayKey(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }

  async getTodaysUsage(): Promise<number> {
    try {
      const todayKey = this.getTodayKey();
      const data = await AsyncStorage.getItem(`${AI_USAGE_KEY}_${todayKey}`);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Error getting AI usage:', error);
      return 0;
    }
  }

  async getRemainingUsage(): Promise<number> {
    const usedToday = await this.getTodaysUsage();
    return Math.max(0, MAX_DAILY_AI_CREATIONS - usedToday);
  }

  async canUseAI(): Promise<boolean> {
    const remaining = await this.getRemainingUsage();
    return remaining > 0;
  }

  async incrementUsage(): Promise<{ success: boolean; remaining: number; error?: string }> {
    try {
      const canUse = await this.canUseAI();
      
      if (!canUse) {
        return {
          success: false,
          remaining: 0,
          error: 'Daily limit reached. You can create 5 AI meals per day with your subscription.'
        };
      }

      const todayKey = this.getTodayKey();
      const currentUsage = await this.getTodaysUsage();
      const newUsage = currentUsage + 1;
      
      await AsyncStorage.setItem(`${AI_USAGE_KEY}_${todayKey}`, newUsage.toString());
      
      const remaining = MAX_DAILY_AI_CREATIONS - newUsage;
      
      return {
        success: true,
        remaining,
      };
    } catch (error) {
      console.error('Error incrementing AI usage:', error);
      return {
        success: false,
        remaining: 0,
        error: 'Failed to track usage'
      };
    }
  }

  async resetDailyUsage(): Promise<void> {
    try {
      const todayKey = this.getTodayKey();
      await AsyncStorage.removeItem(`${AI_USAGE_KEY}_${todayKey}`);
    } catch (error) {
      console.error('Error resetting AI usage:', error);
    }
  }

  // Clean up old usage data (call this periodically)
  async cleanupOldData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const aiKeys = allKeys.filter(key => key.startsWith(AI_USAGE_KEY));
      const todayKey = this.getTodayKey();
      
      // Remove keys older than 7 days
      const keysToRemove = aiKeys.filter(key => {
        const dateStr = key.replace(`${AI_USAGE_KEY}_`, '');
        if (dateStr === todayKey) return false; // Keep today
        
        try {
          const keyDate = new Date(dateStr);
          const daysDiff = (new Date().getTime() - keyDate.getTime()) / (1000 * 3600 * 24);
          return daysDiff > 7;
        } catch {
          return true; // Remove invalid keys
        }
      });
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old AI usage entries`);
      }
    } catch (error) {
      console.error('Error cleaning up old AI usage data:', error);
    }
  }

  // Get usage statistics
  async getUsageStats(): Promise<{
    todayUsage: number;
    remaining: number;
    dailyLimit: number;
    resetTime: string;
  }> {
    const todayUsage = await this.getTodaysUsage();
    const remaining = await this.getRemainingUsage();
    
    // Calculate when the usage resets (midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    return {
      todayUsage,
      remaining,
      dailyLimit: MAX_DAILY_AI_CREATIONS,
      resetTime: tomorrow.toISOString(),
    };
  }

  // For development/testing - allow override of daily limit
  static readonly MAX_DAILY_LIMIT = MAX_DAILY_AI_CREATIONS;
}

export const aiUsageTracker = AIUsageTracker.getInstance();
