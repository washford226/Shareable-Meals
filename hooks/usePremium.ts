import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { revenueCatManager, SubscriptionStatus } from '../utils/revenueCat';
import { supabase } from '../utils/supabase';

export interface AppAccessState {
  isLoading: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  hasAppAccess: boolean;
  accessReason?: 'active_subscription' | 'trial' | 'no_subscription' | 'expired';
  daysRemaining?: number;
  error: string | null;
}

export const useSubscription = () => {
  const [state, setState] = useState<AppAccessState>({
    isLoading: true,
    subscriptionStatus: null,
    hasAppAccess: false,
    error: null
  });

  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Initialize RevenueCat with current user ID
      const { data: { user } } = await supabase.auth.getUser();
      await revenueCatManager.initialize(user?.id);
      
      const [subscriptionStatus, appAccess] = await Promise.all([
        revenueCatManager.getSubscriptionStatus(),
        revenueCatManager.checkAppAccess()
      ]);
      
      setState(prev => ({ 
        ...prev, 
        subscriptionStatus,
        hasAppAccess: appAccess.hasAccess,
        accessReason: appAccess.reason,
        daysRemaining: appAccess.daysRemaining,
        isLoading: false 
      }));
    } catch (error: any) {
      console.error('Error refreshing subscription status:', error);
      // In development/Expo Go, default to no access to test paywall
      const isDevelopment = __DEV__;
      setState(prev => ({ 
        ...prev, 
        error: isDevelopment ? null : (error.message || 'Failed to load subscription status'),
        hasAppAccess: false,
        accessReason: 'no_subscription',
        subscriptionStatus: {
          isActive: false,
          productId: null,
          expirationDate: null,
          willRenew: false,
          isTrialActive: false
        },
        isLoading: false 
      }));
    }
  }, []);

  useEffect(() => {
    refreshSubscriptionStatus();
  }, [refreshSubscriptionStatus]);

  // Check if user has active subscription
  const hasActiveSubscription = useCallback((): boolean => {
    return state.hasAppAccess;
  }, [state.hasAppAccess]);

  // Get subscription status display text
  const getSubscriptionStatusText = useCallback((): string => {
    if (state.isLoading) return 'Checking subscription...';
    if (state.error) return 'Subscription status unknown';
    
    if (!state.subscriptionStatus) return 'No subscription';
    
    if (state.accessReason === 'trial' && state.daysRemaining !== undefined) {
      return `Free trial • ${state.daysRemaining} days remaining`;
    } else if (state.accessReason === 'active_subscription') {
      if (state.subscriptionStatus.expirationDate) {
        const expDate = new Date(state.subscriptionStatus.expirationDate);
        const formattedDate = expDate.toLocaleDateString();
        return state.subscriptionStatus.willRenew 
          ? `Active • Renews ${formattedDate}` 
          : `Active • Expires ${formattedDate}`;
      }
      return 'Active Subscription';
    } else if (state.accessReason === 'expired') {
      return 'Subscription Expired';
    }
    
    return 'No Active Subscription';
  }, [state]);

  // Show subscription required alert
  const requireSubscription = useCallback((
    customMessage?: string,
    onSubscribe?: () => void
  ) => {
    if (hasActiveSubscription()) {
      return true;
    }

    const message = customMessage || 
      'A subscription is required to use this app. Subscribe now to access all features!';

    Alert.alert(
      '🔒 Subscription Required',
      message,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Subscribe Now',
          onPress: onSubscribe || (() => {}),
          style: 'default'
        }
      ]
    );

    return false;
  }, [hasActiveSubscription]);

  return {
    // State
    isLoading: state.isLoading,
    subscriptionStatus: state.subscriptionStatus,
    hasAppAccess: state.hasAppAccess,
    accessReason: state.accessReason,
    daysRemaining: state.daysRemaining,
    error: state.error,
    
    // Actions
    refreshSubscriptionStatus,
    
    // Checkers
    hasActiveSubscription,
    requireSubscription,
    
    // UI Helpers
    getSubscriptionStatusText,
  };
};
