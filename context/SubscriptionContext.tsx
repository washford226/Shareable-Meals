import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

interface SubscriptionContextType {
  isPremium: boolean;
  isLoading: boolean;
  checkPremiumStatus: () => Promise<void>;
  upgradeToPremium: () => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPremiumStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsPremium(false);
        setIsLoading(false);
        return;
      }

      // Check if user has an active subscription
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking subscription:', error);
        setIsPremium(false);
      } else {
        setIsPremium(!!subscription);
      }
    } catch (error) {
      console.error('Error in checkPremiumStatus:', error);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeToPremium = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // For now, we'll just set the user as premium
      // In a real app, you'd integrate with payment processing (Stripe, etc.)
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_type: 'premium',
          is_active: true,
          started_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        });

      if (error) {
        console.error('Error upgrading to premium:', error);
        return false;
      }

      setIsPremium(true);
      return true;
    } catch (error) {
      console.error('Error in upgradeToPremium:', error);
      return false;
    }
  };

  const cancelSubscription = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_subscriptions')
        .update({ is_active: false, cancelled_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error cancelling subscription:', error);
        return false;
      }

      setIsPremium(false);
      return true;
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      return false;
    }
  };

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  const value: SubscriptionContextType = {
    isPremium,
    isLoading,
    checkPremiumStatus,
    upgradeToPremium,
    cancelSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}