import { supabase } from './supabase';

/**
 * Database utility functions for subscription management
 */
export class SubscriptionDB {
  
  /**
   * Check if the current user has an active premium subscription
   */
  static async checkPremiumStatus(userId?: string): Promise<boolean> {
    try {
      let targetUserId = userId;
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        targetUserId = user.id;
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('is_active, expiration_date')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.log('No active subscription found:', error.message);
        return false;
      }

      // Check if subscription is still valid (not expired)
      if (data.expiration_date) {
        const now = new Date();
        const expirationDate = new Date(data.expiration_date);
        
        if (expirationDate < now) {
          console.log('Subscription expired on:', expirationDate);
          return false;
        }
      }

      return data.is_active;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Get subscription details for the current user
   */
  static async getSubscriptionDetails(userId?: string) {
    try {
      let targetUserId = userId;
      
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        targetUserId = user.id;
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (error) {
        console.log('No subscription record found:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting subscription details:', error);
      return null;
    }
  }

  /**
   * Update subscription status in the database
   */
  static async updateSubscription(subscriptionData: {
    user_id: string;
    revenue_cat_user_id?: string;
    product_id?: string;
    is_active: boolean;
    is_trial?: boolean;
    expiration_date?: string | null;
    will_renew?: boolean;
  }) {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          ...subscriptionData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Failed to update subscription:', error);
        return false;
      }

      console.log('Subscription updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return false;
    }
  }

  /**
   * Create a new subscription record
   */
  static async createSubscription(subscriptionData: {
    user_id: string;
    revenue_cat_user_id: string;
    product_id: string;
    is_active: boolean;
    is_trial?: boolean;
    expiration_date?: string | null;
    will_renew?: boolean;
  }) {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .insert(subscriptionData);

      if (error) {
        console.error('Failed to create subscription:', error);
        return false;
      }

      console.log('Subscription created successfully');
      return true;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return false;
    }
  }

  /**
   * Cancel/deactivate a subscription
   */
  static async cancelSubscription(userId: string) {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ 
          is_active: false,
          will_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to cancel subscription:', error);
        return false;
      }

      console.log('Subscription cancelled successfully');
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }
}