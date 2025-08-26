import { useState, useEffect, useCallback } from 'react';
import { aiUsageTracker } from '../utils/aiUsageTracker';
import { useSubscription } from './usePremium';

export interface AIUsageState {
  todayUsage: number;
  remaining: number;
  dailyLimit: number;
  canUse: boolean;
  isLoading: boolean;
  resetTime: string;
}

export const useAIUsage = () => {
  const { hasAppAccess } = useSubscription();
  const [usageState, setUsageState] = useState<AIUsageState>({
    todayUsage: 0,
    remaining: 0,
    dailyLimit: 5,
    canUse: false,
    isLoading: true,
    resetTime: '',
  });

  const loadUsageStats = useCallback(async () => {
    try {
      const stats = await aiUsageTracker.getUsageStats();
      // In development mode, always allow usage regardless of limits
      const canUse = __DEV__ || (hasAppAccess && stats.remaining > 0);
      
      setUsageState({
        todayUsage: stats.todayUsage,
        remaining: __DEV__ ? 999 : stats.remaining, // Show high number in dev mode
        dailyLimit: stats.dailyLimit,
        canUse,
        isLoading: false,
        resetTime: stats.resetTime,
      });
    } catch (error) {
      console.error('Error loading AI usage stats:', error);
      setUsageState(prev => ({
        ...prev,
        isLoading: false,
        canUse: __DEV__, // Still allow in dev mode even if there's an error
      }));
    }
  }, [hasAppAccess]);

  const useAICreation = useCallback(async (): Promise<{
    success: boolean;
    remaining: number;
    error?: string;
  }> => {
    // In development mode, always allow usage
    if (__DEV__) {
      // Still track usage in dev mode for testing, but don't enforce limits
      await aiUsageTracker.incrementUsage();
      await loadUsageStats();
      return {
        success: true,
        remaining: 999,
      };
    }

    if (!hasAppAccess) {
      return {
        success: false,
        remaining: 0,
        error: 'Subscription required to use AI meal creation'
      };
    }

    const result = await aiUsageTracker.incrementUsage();
    
    // Refresh stats after usage
    await loadUsageStats();
    
    return result;
  }, [hasAppAccess, loadUsageStats]);

  const resetUsage = useCallback(async () => {
    await aiUsageTracker.resetDailyUsage();
    await loadUsageStats();
  }, [loadUsageStats]);

  // Load stats on mount and when subscription status changes
  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  // Clean up old data periodically
  useEffect(() => {
    const cleanup = async () => {
      await aiUsageTracker.cleanupOldData();
    };
    cleanup();
  }, []);

  return {
    ...usageState,
    useAICreation,
    refreshStats: loadUsageStats,
    resetUsage, // For development/testing
  };
};
