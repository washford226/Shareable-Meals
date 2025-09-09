import { revenueCatManager, SubscriptionStatus, PurchaseResult } from '../../utils/revenueCat';
import Purchases, { CustomerInfo, PurchasesPackage, PurchasesEntitlementInfo } from 'react-native-purchases';
import { supabase } from '../../utils/supabase';

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  presentCodeRedemptionSheet: jest.fn(),
  syncPurchases: jest.fn(),
  getCustomerInfo: jest.fn(),
  LOG_LEVEL: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
  }
}));

// Mock supabase
jest.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      upsert: jest.fn()
    }))
  }
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios'
  }
}));

describe('RevenueCatManager', () => {
  const mockEntitlement: PurchasesEntitlementInfo = {
    identifier: 'premium',
    productIdentifier: 'monthly_subscription',
    isActive: true,
    willRenew: true,
    expirationDate: '2025-10-04T12:00:00Z',
    originalPurchaseDate: '2025-09-04T12:00:00Z',
    latestPurchaseDate: '2025-09-04T12:00:00Z',
    expirationDateMillis: 1728039600000,
    originalPurchaseDateMillis: 1725451200000,
    latestPurchaseDateMillis: 1725451200000,
    store: 'APP_STORE' as any,
    isSandbox: false,
    ownershipType: 'PURCHASED' as any,
    periodType: 'NORMAL' as any,
    productPlanIdentifier: null,
    unsubscribeDetectedAt: null,
    billingIssueDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAtMillis: null,
    verification: 'VERIFIED' as any
  };

  const mockCustomerInfo: CustomerInfo = {
    originalAppUserId: 'test-user-123',
    entitlements: {
      active: {
        'premium': mockEntitlement
      },
      all: {
        'premium': mockEntitlement
      },
      verification: 'VERIFIED' as any
    },
    allPurchaseDates: {},
    allExpirationDates: {},
    activeSubscriptions: ['monthly_subscription'],
    allPurchasedProductIdentifiers: ['monthly_subscription'],
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    firstSeen: '2025-09-04T12:00:00Z',
    originalApplicationVersion: '1.0.0',
    requestDate: '2025-09-04T12:00:00Z',
    latestExpirationDate: '2025-10-04T12:00:00Z',
    originalPurchaseDate: '2025-09-04T12:00:00Z',
    managementURL: null
  };

  const mockOfferings = {
    current: {
      identifier: 'default',
      serverDescription: 'Default offering',
      availablePackages: {
        'monthly': {
          identifier: 'monthly',
          packageType: 'MONTHLY',
          product: {
            identifier: 'monthly_subscription',
            title: 'Monthly Subscription',
            description: 'Access to all premium features',
            price: 9.99,
            currencyCode: 'USD',
            priceString: '$9.99'
          },
          offeringIdentifier: 'default'
        } as PurchasesPackage,
        'annual': {
          identifier: 'annual',
          packageType: 'ANNUAL',
          product: {
            identifier: 'annual_subscription',
            title: 'Annual Subscription',
            description: 'Access to all premium features',
            price: 99.99,
            currencyCode: 'USD',
            priceString: '$99.99'
          },
          offeringIdentifier: 'default'
        } as PurchasesPackage
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the manager's internal state
    (revenueCatManager as any).isInitialized = false;
    (revenueCatManager as any).mockSubscriptionActive = false;

    // Mock supabase auth
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'test-user-123' } }
    });

    // Mock supabase upsert
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null })
    });
  });

  describe('initialize', () => {
    it('should configure RevenueCat successfully', async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      (Purchases.setLogLevel as jest.Mock).mockResolvedValue(undefined);

      await revenueCatManager.initialize('test-user-123');

      expect(Purchases.configure).toHaveBeenCalledWith({
        apiKey: 'appl_yanmwOxgRTMnRrTxdrZUtwdjjoo',
        appUserID: 'test-user-123'
      });
      expect(Purchases.setLogLevel).toHaveBeenCalledWith('DEBUG');
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Configuration failed');
      (Purchases.configure as jest.Mock).mockRejectedValue(error);

      await expect(revenueCatManager.initialize()).rejects.toThrow('Configuration failed');
    });

    it('should not initialize twice', async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      
      await revenueCatManager.initialize();
      await revenueCatManager.initialize(); // Second call

      expect(Purchases.configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOfferings', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should return available packages', async () => {
      (Purchases.getOfferings as jest.Mock).mockResolvedValue(mockOfferings);

      const packages = await revenueCatManager.getOfferings();

      expect(packages).toHaveLength(2);
      expect(packages[0].identifier).toBe('monthly');
      expect(packages[1].identifier).toBe('annual');
    });

    it('should return empty array when no current offering', async () => {
      (Purchases.getOfferings as jest.Mock).mockResolvedValue({ current: null });

      const packages = await revenueCatManager.getOfferings();

      expect(packages).toEqual([]);
    });

    it('should handle getOfferings errors in development', async () => {
      const error = new Error('Network error');
      (Purchases.getOfferings as jest.Mock).mockRejectedValue(error);

      // In development mode (__DEV__ = true), should return empty array
      const packages = await revenueCatManager.getOfferings();

      expect(packages).toEqual([]);
    });
  });

  describe('purchasePackage', () => {
    const mockPackage = mockOfferings.current.availablePackages.monthly;

    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should purchase package successfully', async () => {
      (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
        customerInfo: mockCustomerInfo,
        productIdentifier: 'monthly_subscription'
      });

      const result = await revenueCatManager.purchasePackage(mockPackage);

      expect(result.success).toBe(true);
      expect(result.customerInfo).toEqual(mockCustomerInfo);
      expect(Purchases.purchasePackage).toHaveBeenCalledWith(mockPackage);
    });

    it('should handle user cancellation', async () => {
      const error = { userCancelled: true, message: 'User cancelled' };
      (Purchases.purchasePackage as jest.Mock).mockRejectedValue(error);

      const result = await revenueCatManager.purchasePackage(mockPackage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Purchase cancelled');
    });

    it('should handle purchase errors', async () => {
      const error = { code: 'PAYMENT_PENDING', message: 'Payment is pending' };
      (Purchases.purchasePackage as jest.Mock).mockRejectedValue(error);

      const result = await revenueCatManager.purchasePackage(mockPackage);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment is pending');
    });

    it('should sync with Supabase after successful purchase', async () => {
      (Purchases.purchasePackage as jest.Mock).mockResolvedValue({
        customerInfo: mockCustomerInfo,
        productIdentifier: 'monthly_subscription'
      });

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

      await revenueCatManager.purchasePackage(mockPackage);

      expect(supabase.from).toHaveBeenCalledWith('user_subscriptions');
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-123',
        revenue_cat_user_id: 'test-user-123',
        product_id: 'monthly_subscription',
        is_active: true,
        is_trial: false,
        will_renew: true
      }));
    });
  });

  describe('restorePurchases', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should restore purchases successfully', async () => {
      (Purchases.restorePurchases as jest.Mock).mockResolvedValue(mockCustomerInfo);

      const result = await revenueCatManager.restorePurchases();

      expect(result.success).toBe(true);
      expect(result.customerInfo).toEqual(mockCustomerInfo);
    });

    it('should handle restore errors', async () => {
      const error = new Error('Restore failed');
      (Purchases.restorePurchases as jest.Mock).mockRejectedValue(error);

      const result = await revenueCatManager.restorePurchases();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Restore failed');
    });
  });

  describe('presentCodeRedemptionSheet', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should present code redemption sheet and sync purchases', async () => {
      (Purchases.presentCodeRedemptionSheet as jest.Mock).mockResolvedValue(undefined);
      (Purchases.syncPurchases as jest.Mock).mockResolvedValue(undefined);
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(mockCustomerInfo);

      await revenueCatManager.presentCodeRedemptionSheet();

      expect(Purchases.presentCodeRedemptionSheet).toHaveBeenCalled();
      expect(Purchases.syncPurchases).toHaveBeenCalled();
      expect(Purchases.getCustomerInfo).toHaveBeenCalled();
    });

    it('should handle code redemption errors', async () => {
      const error = new Error('Sheet presentation failed');
      (Purchases.presentCodeRedemptionSheet as jest.Mock).mockRejectedValue(error);

      await expect(revenueCatManager.presentCodeRedemptionSheet()).rejects.toThrow('Sheet presentation failed');
    });
  });

  describe('getSubscriptionStatus', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should return active subscription status', async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(mockCustomerInfo);

      const status = await revenueCatManager.getSubscriptionStatus();

      expect(status.isActive).toBe(true);
      expect(status.productId).toBe('monthly_subscription');
      expect(status.willRenew).toBe(true);
      expect(status.expirationDate).toBe('2025-10-04T12:00:00Z');
    });

    it('should return inactive status when no active entitlements', async () => {
      const inactiveCustomerInfo = {
        ...mockCustomerInfo,
        entitlements: { active: {}, all: {} }
      };
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(inactiveCustomerInfo);

      const status = await revenueCatManager.getSubscriptionStatus();

      expect(status.isActive).toBe(false);
      expect(status.productId).toBeNull();
      expect(status.willRenew).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Network error');
      (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(error);

      const status = await revenueCatManager.getSubscriptionStatus();

      expect(status.isActive).toBe(false);
      expect(status.productId).toBeNull();
    });
  });

  describe('hasActiveSubscription', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should return true for active subscription', async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(mockCustomerInfo);

      const hasAccess = await revenueCatManager.hasActiveSubscription();

      expect(hasAccess).toBe(true);
    });

    it('should return true for active trial', async () => {
      const trialCustomerInfo = {
        ...mockCustomerInfo,
        entitlements: {
          active: {
            'premium': {
              ...mockCustomerInfo.entitlements.active.premium,
              willRenew: false,
              originalPurchaseDate: '2025-09-01T12:00:00Z', // Recent purchase
              expirationDate: '2025-09-08T12:00:00Z' // 7 days later
            }
          },
          all: {}
        }
      };
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(trialCustomerInfo);

      const hasAccess = await revenueCatManager.hasActiveSubscription();

      expect(hasAccess).toBe(true);
    });

    it('should return false for inactive subscription', async () => {
      const inactiveCustomerInfo = {
        ...mockCustomerInfo,
        entitlements: { active: {}, all: {} }
      };
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(inactiveCustomerInfo);

      const hasAccess = await revenueCatManager.hasActiveSubscription();

      expect(hasAccess).toBe(false);
    });
  });

  describe('checkAppAccess', () => {
    beforeEach(async () => {
      (Purchases.configure as jest.Mock).mockResolvedValue(undefined);
      await revenueCatManager.initialize();
    });

    it('should return access for active subscription', async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(mockCustomerInfo);

      const access = await revenueCatManager.checkAppAccess();

      expect(access.hasAccess).toBe(true);
      expect(access.reason).toBe('active_subscription');
    });

    it('should return trial access with days remaining', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days from now

      const trialCustomerInfo = {
        ...mockCustomerInfo,
        entitlements: {
          active: {
            'premium': {
              ...mockCustomerInfo.entitlements.active.premium,
              willRenew: false,
              expirationDate: futureDate.toISOString()
            }
          },
          all: {}
        }
      };
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(trialCustomerInfo);

      const access = await revenueCatManager.checkAppAccess();

      expect(access.hasAccess).toBe(true);
      expect(access.reason).toBe('trial');
      expect(access.daysRemaining).toBeGreaterThan(4);
    });

    it('should return no access for inactive subscription', async () => {
      const inactiveCustomerInfo = {
        ...mockCustomerInfo,
        entitlements: { active: {}, all: {} }
      };
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(inactiveCustomerInfo);

      const access = await revenueCatManager.checkAppAccess();

      expect(access.hasAccess).toBe(false);
      expect(access.reason).toBe('no_subscription');
    });
  });
});
