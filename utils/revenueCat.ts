import Purchases, { 
  PurchasesOffering, 
  PurchasesPackage, 
  CustomerInfo, 
  PurchasesStoreProduct,
  LOG_LEVEL 
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Check if we're in development mode (Expo Go)
const isDevelopmentMode = __DEV__ && !Platform.OS.includes('web');
const isExpoGo = false; // Only true when actually running in Expo Go

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
      
      // Only skip RevenueCat initialization in actual Expo Go environment
      if (isExpoGo) {
        console.log('🔧 Development Mode: Skipping RevenueCat initialization (Expo Go detected)');
        this.isInitialized = true;
        this.mockSubscriptionActive = false;
        return;
      }
      
      // Configure RevenueCat for both development and production builds
      await Purchases.configure({
        apiKey: 'appl_yanmwOxgRTMnRrTxdrZUtwdjjoo',
        appUserID: userId || undefined,
      });
      
      // Enable debug logging in development
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      
      this.isInitialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Error configuring Purchases:', error);
      // Only fall back to mock in actual Expo Go
      if (isExpoGo) {
        console.log('🔧 Development Mode: Falling back to mock mode');
        this.isInitialized = true;
        this.mockSubscriptionActive = false;
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
      
      // Return empty offerings only in actual Expo Go
      if (isExpoGo) {
        console.log('🔧 Development Mode: Returning empty offerings (Expo Go)');
        return [];
      }
      
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        console.warn('No current offering available - check App Store Connect configuration');
        return [];
      }
      
      console.log('Available packages:', Object.keys(currentOffering.availablePackages));
      return Object.values(currentOffering.availablePackages);
    } catch (error) {
      console.error('Error fetching offerings:', error);
      // Don't return empty array in production - let the UI handle the error
      if (!__DEV__) {
        throw error;
      }
      return [];
    }
  }

  async purchasePackage(purchasePackage: PurchasesPackage): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log('Attempting to purchase package:', purchasePackage.identifier);
      
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(purchasePackage);
      
      console.log('Purchase successful for product:', productIdentifier);
      console.log('Customer info entitlements:', Object.keys(customerInfo.entitlements.all));
      
      // Sync with Supabase
      await this.syncSubscriptionWithSupabase(customerInfo);
      
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      // Log specific error details for debugging
      if (error.code) {
        console.error('Purchase error code:', error.code);
      }
      if (error.userCancelled) {
        console.log('Purchase was cancelled by user');
        return { success: false, error: 'Purchase cancelled' };
      }
      
      return { 
        success: false, 
        error: error.message || error.userInfo?.localizedDescription || 'Purchase failed' 
      };
    }
  }

  async restorePurchases(): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log('Attempting to restore purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('Restore completed. Active entitlements:', Object.keys(customerInfo.entitlements.active));
      
      // Sync with Supabase
      await this.syncSubscriptionWithSupabase(customerInfo);
      
      return { success: true, customerInfo };
    } catch (error: any) {
      console.error('Restore failed:', error);
      return { 
        success: false, 
        error: error.message || error.userInfo?.localizedDescription || 'Restore failed' 
      };
    }
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Skip in Expo Go - simulate the sheet presentation
      if (isExpoGo) {
        console.log('🔧 Development Mode: Simulating code redemption sheet presentation');
        // Simulate user redeeming a code for testing
        this.mockSubscriptionActive = true;
        return;
      }
      
      // Present Apple's native code redemption sheet (iOS 14+ only)
      // This method doesn't return success/failure - Apple handles everything
      await Purchases.presentCodeRedemptionSheet();
      
      // After presentation (whether user redeemed or cancelled), sync purchases
      await Purchases.syncPurchases();
      
      // Get updated customer info and sync with Supabase
      const customerInfo = await Purchases.getCustomerInfo();
      await this.syncSubscriptionWithSupabase(customerInfo);
    } catch (error: any) {
      console.error('Failed to present code redemption sheet:', error);
      throw error;
    }
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Return mock status only in actual Expo Go
      if (isExpoGo) {
        return {
          isActive: this.mockSubscriptionActive,
          productId: null,
          expirationDate: null,
          willRenew: false,
          isTrialActive: false,
        };
      }
      
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('Customer info retrieved. Active entitlements:', Object.keys(customerInfo.entitlements.active));
      
      return this.parseSubscriptionStatus(customerInfo);
    } catch (error) {
      console.error('Error getting subscription status:', error);
      // Return default inactive status instead of throwing
      return {
        isActive: false,
        productId: null,
        expirationDate: null,
        willRenew: false,
        isTrialActive: false,
      };
    }
  }

  async hasActiveSubscription(): Promise<boolean> {
    try {
      // Return mock status only in actual Expo Go
      if (isExpoGo) {
        console.log('🔧 Development Mode: No active subscription (testing paywall)');
        return this.mockSubscriptionActive;
      }
      
      const status = await this.getSubscriptionStatus();
      const hasAccess = status.isActive || status.isTrialActive;
      
      console.log('Subscription check result:', {
        isActive: status.isActive,
        isTrialActive: status.isTrialActive,
        productId: status.productId,
        hasAccess
      });
      
      return hasAccess;
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