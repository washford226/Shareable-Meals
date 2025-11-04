import React, { createContext, useContext, useState, useEffect } from 'react';
import Purchases, { 
  PurchasesPackage, 
  CustomerInfo, 
  PurchasesEntitlementInfo,
  LOG_LEVEL 
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// RevenueCat API Keys - Your actual keys
const REVENUECAT_API_KEY_IOS = 'appl_yanmwOxgRTMnRrTxdrZUtwdjjoo';
const REVENUECAT_API_KEY_ANDROID = 'appl_yanmwOxgRTMnRrTxdrZUtwdjjoo'; // Use same key for both platforms

// RevenueCat Test Store API Key for Expo Go testing
const REVENUECAT_TEST_STORE_KEY = 'rctstsk_YOUR_TEST_STORE_KEY_HERE'; // You'll get this from RevenueCat

// Product IDs - These match your existing RevenueCat setup
const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'com.williamashford.shareablemeals.Monthly', // Your existing product
  MONTHLY_RC_ID: '$rc_monthly', // RevenueCat identifier
};

interface RevenueCatContextType {
  isPremium: boolean;
  isLoading: boolean;
  packages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  purchasePackage: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkPremiumStatus: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}

interface RevenueCatProviderProps {
  children: React.ReactNode;
}

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    initializePurchases();
  }, []);

  const initializePurchases = async () => {
    try {
      console.log('Initializing RevenueCat...');
      console.log('Running in Expo Go:', isExpoGo);
      
      // Skip RevenueCat initialization in Expo Go for now
      if (isExpoGo) {
        console.log('🔄 Running in Expo Go - Using mock RevenueCat data');
        console.log('ℹ️  For full RevenueCat functionality, use: npx expo run:ios or npx expo run:android');
        
        // Set mock packages for testing UI in Expo Go
        const mockPackages = [{
          identifier: 'mock_monthly_premium',
          packageType: 'MONTHLY' as const,
          product: {
            identifier: 'com.williamashford.shareablemeals.Monthly',
            price: 3.99,
            priceString: '$3.99',
            currencyCode: 'USD',
            title: 'Premium Monthly Subscription'
          }
        }];
        
        setPackages(mockPackages as any);
        setIsPremium(false); // Default to free for testing
        setIsLoading(false);
        console.log('📦 Mock packages loaded for Expo Go testing');
        return;
      }

      // Configure RevenueCat for real device/development build
      Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Remove in production
      
      // Initialize with platform-specific API key
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      await Purchases.configure({ apiKey });

      // Set user ID if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Purchases.logIn(user.id);
        console.log('RevenueCat user logged in:', user.id);
      }

      // Load offerings and check premium status
      await loadOfferings();
      await checkPremiumStatus();
      
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      
      // Fallback to database-only mode
      console.log('Falling back to database-only subscription checking');
      await checkPremiumStatusFromDatabase();
    } finally {
      setIsLoading(false);
    }
  };

  const checkPremiumStatusFromDatabase = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsPremium(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('is_active, expiration_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.log('No active subscription found in database');
        setIsPremium(false);
        return;
      }

      // Check if subscription is still valid
      if (data.expiration_date) {
        const now = new Date();
        const expirationDate = new Date(data.expiration_date);
        
        if (expirationDate < now) {
          console.log('Subscription expired on:', expirationDate);
          setIsPremium(false);
          return;
        }
      }

      setIsPremium(data.is_active);
      console.log('Premium status from database:', data.is_active);
    } catch (error) {
      console.error('Error checking database subscription:', error);
      setIsPremium(false);
    }
  };

  const loadOfferings = async () => {
    try {
      // Skip in Expo Go
      if (isExpoGo) {
        console.log('📦 Mock offerings already loaded in Expo Go');
        return;
      }

      console.log('🔄 Loading RevenueCat offerings...');
      const offerings = await Purchases.getOfferings();
      console.log('📦 Available offerings:', Object.keys(offerings.all));
      console.log('📦 Current offering:', offerings.current?.identifier);
      
      // Get the "default" offering that you have configured
      const defaultOffering = offerings.all['default'] || offerings.current;
      
      if (defaultOffering && defaultOffering.availablePackages.length > 0) {
        setPackages(defaultOffering.availablePackages);
        console.log('✅ Loaded packages from default offering:', defaultOffering.availablePackages.length);
        console.log('📋 Package details:', defaultOffering.availablePackages.map(pkg => ({
          identifier: pkg.identifier,
          packageType: pkg.packageType,
          product: pkg.product?.identifier,
          price: pkg.product?.priceString,
          currencyCode: pkg.product?.currencyCode
        })));
      } else {
        console.log('❌ No packages available in default offering');
        console.log('Available offerings:', Object.keys(offerings.all));
        
        // Try to get packages from any available offering
        for (const [key, offering] of Object.entries(offerings.all)) {
          if (offering.availablePackages.length > 0) {
            console.log(`✅ Found packages in offering: ${key}`);
            setPackages(offering.availablePackages);
            break;
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to load offerings:', error);
    }
  };

  const checkPremiumStatus = async () => {
    try {
      // In Expo Go, check database only
      if (isExpoGo) {
        await checkPremiumStatusFromDatabase();
        return;
      }

      const customerInfo = await Purchases.getCustomerInfo();
      setCustomerInfo(customerInfo);
      
      // Check if user has premium entitlement
      const isPremiumActive = customerInfo.entitlements.active['premium'] !== undefined;
      setIsPremium(isPremiumActive);
      
      console.log('Premium status:', isPremiumActive);
      console.log('Active entitlements:', Object.keys(customerInfo.entitlements.active));
      
      // Sync with Supabase
      await syncWithSupabase(customerInfo);
      
    } catch (error) {
      console.error('Failed to check premium status:', error);
      
      // Fallback to database check
      await checkPremiumStatusFromDatabase();
    }
  };

  const syncWithSupabase = async (customerInfo: CustomerInfo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isPremiumActive = customerInfo.entitlements.active['premium'] !== undefined;
      const premiumEntitlement = customerInfo.entitlements.active['premium'];
      
      // Get the product ID from the active entitlement or first active purchase
      const productId = premiumEntitlement?.productIdentifier || 
                       Object.values(customerInfo.activeSubscriptions)[0] || 
                       'com.williamashford.shareablemeals.Monthly';
      
      // Update or insert subscription record in Supabase using your schema
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          revenue_cat_user_id: customerInfo.originalAppUserId,
          product_id: productId,
          is_active: isPremiumActive,
          is_trial: premiumEntitlement?.isActive && premiumEntitlement?.isSandbox,
          expiration_date: premiumEntitlement?.expirationDate || null,
          will_renew: premiumEntitlement?.willRenew || false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id' // Update existing record for this user
        });

      if (error) {
        console.error('Failed to sync with Supabase:', error);
      } else {
        console.log('Synced subscription with Supabase');
      }
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    }
  };

  const purchasePackage = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
    try {
      // In Expo Go, show informational alert
      if (isExpoGo) {
        Alert.alert(
          'Expo Go Limitation',
          'Real purchases are not available in Expo Go. Please use a development build to test purchases.',
          [
            { 
              text: 'Simulate Premium (Demo)', 
              onPress: () => {
                setIsPremium(true);
                Alert.alert('Demo Mode', 'Premium features unlocked for demo purposes!');
              }
            },
            { text: 'OK' }
          ]
        );
        return false;
      }

      setIsLoading(true);
      console.log('Attempting to purchase:', packageToPurchase.identifier);
      
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('Purchase successful!', customerInfo);
      
      // Update premium status
      await checkPremiumStatus();
      
      return true;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (!error.userCancelled) {
        Alert.alert(
          'Purchase Failed',
          'There was an issue processing your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      // In Expo Go, check database for existing subscription
      if (isExpoGo) {
        await checkPremiumStatusFromDatabase();
        const hasDbSubscription = isPremium;
        
        Alert.alert(
          'Expo Go Limitation',
          hasDbSubscription 
            ? 'Found existing subscription in database!' 
            : 'No active subscriptions found in database. Use a development build for full restore functionality.',
          [{ text: 'OK' }]
        );
        
        return hasDbSubscription;
      }

      setIsLoading(true);
      console.log('Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      console.log('Purchases restored:', customerInfo);
      
      // Update premium status
      await checkPremiumStatus();
      
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasActiveSubscription) {
        Alert.alert(
          'Purchases Restored',
          'Your premium subscription has been restored!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No active subscriptions were found to restore.',
          [{ text: 'OK' }]
        );
      }
      
      return hasActiveSubscription;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const value: RevenueCatContextType = {
    isPremium,
    isLoading,
    packages,
    customerInfo,
    purchasePackage,
    restorePurchases,
    checkPremiumStatus,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}