import Purchases, { 
  PurchasesOffering, 
  PurchasesPackage, 
  CustomerInfo, 
  PurchasesStoreProduct 
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Check if we're in development mode (Expo Go)
const isDevelopmentMode = __DEV__ && !Platform.OS.includes('web');
const isExpoGo = __DEV__; // Allow toggling for Expo testing

// Types and interfaces
export interface SubscriptionStatus {
  isActive: boolean;
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  isTrialActive: boolean;
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

class RevenueCatManager {
  private isInitialized = false;
  private mockSubscriptionActive = false; // Default to no subscription for paywall testing

  async initialize(userId?: string): Promise<void> {
    try {
      if (this.isInitialized) return;
      
      // Configure RevenueCat (works in both Expo Go and production)
      await Purchases.configure({
        apiKey: 'appl_yanmwOxgRTMnRrTxdrZUtwdjjoo',
        appUserID: userId || undefined
      });
      
      this.isInitialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      // In development, continue with mock data
      if (isDevelopmentMode) {
        console.log('🔧 Falling back to no subscription (testing paywall)');
        this.isInitialized = true;
        return;
      }
      throw error;
    }
  }

  async getOfferings(): Promise<PurchasesPackage[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        console.warn('No current offering available');
        return [];
      }
      
      return Object.values(currentOffering.availablePackages);
    } catch (error) {
      console.error('Error fetching offerings:', error);
      throw error;
    }
  }

  async purchasePackage(purchasePackage: PurchasesPackage): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const { customerInfo } = await Purchases.purchasePackage(purchasePackage);
      
      // Sync with Supabase
      await this.syncSubscriptionWithSupabase(customerInfo);
      
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('Purchase failed:', error);
      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  async restorePurchases(): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const customerInfo = await Purchases.restorePurchases();
      
      // Sync with Supabase
      await this.syncSubscriptionWithSupabase(customerInfo);
      
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('Restore failed:', error);
      return { success: false, error: error.message || 'Restore failed' };
    }
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const customerInfo = await Purchases.getCustomerInfo();
      return this.parseSubscriptionStatus(customerInfo);
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  async hasActiveSubscription(): Promise<boolean> {
    try {
      // Return mock status in development
      if (isExpoGo || !this.isInitialized) {
        console.log('🔧 Development Mode: No active subscription (testing paywall)');
        return this.mockSubscriptionActive;
      }
      
      const status = await this.getSubscriptionStatus();
      return status.isActive || status.isTrialActive;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false; // Default to false if we can't check
    }
  }

  private parseSubscriptionStatus(customerInfo: CustomerInfo): SubscriptionStatus {
    const activeEntitlements = customerInfo.entitlements.active;
    const isActive = Object.keys(activeEntitlements).length > 0;
    
    let productId: string | null = null;
    let expirationDate: string | null = null;
    let willRenew = false;
    let isTrialActive = false;
    
    if (isActive) {
      const firstEntitlement = Object.values(activeEntitlements)[0];
      productId = firstEntitlement.productIdentifier;
      expirationDate = firstEntitlement.expirationDate;
      willRenew = firstEntitlement.willRenew;
      
      // Check if this is a trial period
      const purchaseDate = firstEntitlement.originalPurchaseDate;
      if (purchaseDate && expirationDate) {
        const purchase = new Date(purchaseDate);
        const expiration = new Date(expirationDate);
        const daysDiff = (expiration.getTime() - purchase.getTime()) / (1000 * 3600 * 24);
        
        // Assume trial if subscription is less than 30 days and it's a first purchase
        isTrialActive = daysDiff <= 14 && !willRenew; // Typical trial period
      }
    }
    
    return {
      isActive,
      productId,
      expirationDate,
      willRenew,
      isTrialActive,
    };
  }

  private async syncSubscriptionWithSupabase(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user for subscription sync');
        return;
      }
      
      const subscriptionStatus = this.parseSubscriptionStatus(customerInfo);
      
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          revenue_cat_user_id: customerInfo.originalAppUserId,
          product_id: subscriptionStatus.productId,
          is_active: subscriptionStatus.isActive,
          is_trial: subscriptionStatus.isTrialActive,
          expiration_date: subscriptionStatus.expirationDate,
          will_renew: subscriptionStatus.willRenew,
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error('Error syncing subscription with Supabase:', error);
        throw error;
      }
      
      console.log('Subscription synced with Supabase successfully');
    } catch (error) {
      console.error('Failed to sync subscription with Supabase:', error);
      // Don't throw here, as this shouldn't block the purchase
    }
  }

  // Check if user has access to the app
  async checkAppAccess(): Promise<{
    hasAccess: boolean;
    reason?: 'active_subscription' | 'trial' | 'no_subscription' | 'expired';
    daysRemaining?: number;
  }> {
    try {
      // Return mock access in development
      if (isExpoGo || !this.isInitialized) {
        console.log('🔧 Development Mode: No app access (testing paywall)');
        return {
          hasAccess: this.mockSubscriptionActive,
          reason: this.mockSubscriptionActive ? 'active_subscription' : 'no_subscription'
        };
      }
      
      const status = await this.getSubscriptionStatus();
      
      if (status.isActive) {
        if (status.isTrialActive && status.expirationDate) {
          const expiration = new Date(status.expirationDate);
          const now = new Date();
          const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 3600 * 24));
          
          return {
            hasAccess: true,
            reason: 'trial',
            daysRemaining: Math.max(0, daysRemaining),
          };
        } else {
          return {
            hasAccess: true,
            reason: 'active_subscription',
          };
        }
      } else {
        return {
          hasAccess: false,
          reason: status.expirationDate ? 'expired' : 'no_subscription',
        };
      }
    } catch (error) {
      console.error('Error checking app access:', error);
      return {
        hasAccess: false,
        reason: 'no_subscription',
      };
    }
  }

  // Development helper method to toggle mock subscription
  toggleMockSubscription(): void {
    if (isExpoGo || isDevelopmentMode) {
      this.mockSubscriptionActive = !this.mockSubscriptionActive;
      console.log(`🔧 Development Mode: Mock subscription ${this.mockSubscriptionActive ? 'activated' : 'deactivated'}`);
    }
  }

  // Development helper to check if we're in mock mode
  isMockMode(): boolean {
    return isExpoGo || (isDevelopmentMode && !this.isInitialized);
  }

  // Present RevenueCat's paywall using offerings
  async presentPaywall(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Instead of using presentPaywall (not available in this SDK version),
      // we'll throw an error to trigger the custom paywall fallback
      console.log('Using custom paywall with RevenueCat offerings');
      throw new Error('Using custom paywall implementation');
    } catch (error) {
      console.error('Error presenting RevenueCat paywall:', error);
      throw error;
    }
  }

  // Present paywall if needed (user doesn't have subscription)
  async presentPaywallIfNeeded(): Promise<boolean> {
    try {
      const hasAccess = await this.hasActiveSubscription();
      if (!hasAccess) {
        await this.presentPaywall();
        return true; // Paywall was presented
      }
      return false; // No paywall needed
    } catch (error) {
      console.error('Error checking if paywall needed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const revenueCatManager = new RevenueCatManager();