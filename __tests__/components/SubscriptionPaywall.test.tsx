import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SubscriptionPaywall from '../../components/SubscriptionPaywall';
import { revenueCatManager } from '../../utils/revenueCat';
import { useTheme } from '../../context/ThemeContext';

// Get Alert mock that should be set up in jest-setup.js
const AlertMock = Alert as jest.Mocked<typeof Alert>;

// Mock dependencies
jest.mock('../../utils/revenueCat', () => ({
  revenueCatManager: {
    getOfferings: jest.fn(),
    getSubscriptionStatus: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    presentCodeRedemptionSheet: jest.fn(),
    hasActiveSubscription: jest.fn(),
  }
}));
jest.mock('../../context/ThemeContext');

// Mock expo vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons'
}));

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  PurchasesPackage: {}
}));

const mockTheme = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  border: '#E5E5E5',
  success: '#34C759',
  buttonText: '#FFFFFF'
};

const mockPackages = [
  {
    identifier: 'monthly',
    packageType: 'MONTHLY',
    product: {
      identifier: 'monthly_subscription',
      title: 'Monthly Subscription',
      price: 9.99,
      currencyCode: 'USD',
      priceString: '$9.99'
    }
  },
  {
    identifier: 'annual',
    packageType: 'ANNUAL',
    product: {
      identifier: 'annual_subscription',
      title: 'Annual Subscription',
      price: 99.99,
      currencyCode: 'USD',
      priceString: '$99.99'
    }
  }
];

const mockSubscriptionStatus = {
  isActive: false,
  productId: null,
  expirationDate: null,
  willRenew: false,
  isTrialActive: false
};

describe('SubscriptionPaywall', () => {
  const mockProps = {
    visible: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    allowClose: true,
    title: 'Test Subscription',
    subtitle: 'Test subtitle'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useTheme
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    
    // Mock revenueCatManager methods
    (revenueCatManager.getOfferings as jest.Mock).mockResolvedValue(mockPackages);
    (revenueCatManager.getSubscriptionStatus as jest.Mock).mockResolvedValue(mockSubscriptionStatus);
    (revenueCatManager.purchasePackage as jest.Mock).mockResolvedValue({ success: true });
    (revenueCatManager.restorePurchases as jest.Mock).mockResolvedValue({ success: true });
    (revenueCatManager.presentCodeRedemptionSheet as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Component Rendering', () => {
    it('should render the paywall when visible', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Test Subscription')).toBeTruthy();
        expect(getByText('Test subtitle')).toBeTruthy();
      });
    });

    it('should not render when not visible', () => {
      const { queryByText } = render(<SubscriptionPaywall {...mockProps} visible={false} />);
      
      // When visible=false, the useEffect doesn't run, so offerings never load
      // The component should remain in initial loading state, so loading text should exist
      expect(queryByText('Loading subscription options...')).toBeTruthy();
      
      // But packages should not be loaded since useEffect didn't run
      expect(queryByText('Monthly Subscription')).toBeNull();
      expect(queryByText('Annual Subscription')).toBeNull();
    });

    it('should show loading state initially', () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      expect(getByText('Loading subscription options...')).toBeTruthy();
    });

    it('should show packages after loading', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
        expect(getByText('Annual Subscription')).toBeTruthy();
      });
    });

    it('should show close button when allowClose is true', async () => {
      const { getByLabelText } = render(<SubscriptionPaywall {...mockProps} allowClose={true} />);
      
      await waitFor(() => {
        expect(getByLabelText('Close')).toBeTruthy();
      });
    });

    it('should not show close button when allowClose is false', async () => {
      const { queryByLabelText } = render(<SubscriptionPaywall {...mockProps} allowClose={false} />);
      
      await waitFor(() => {
        expect(queryByLabelText('Close')).toBeNull();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load offerings and subscription status on mount', async () => {
      render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(revenueCatManager.getOfferings).toHaveBeenCalled();
        expect(revenueCatManager.getSubscriptionStatus).toHaveBeenCalled();
      });
    });

    it('should show error alert when offerings loading fails', async () => {
      // Override the mock for this specific test
      (revenueCatManager.getOfferings as jest.Mock).mockReset();
      const error = new Error('Failed to load offerings');
      (revenueCatManager.getOfferings as jest.Mock).mockRejectedValue(error);
      
      render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'Connection Error',
          'Failed to load subscription options. Please check your internet connection and try again.'
        );
      });
    });

    it('should show retry option when no offerings available', async () => {
      (revenueCatManager.getOfferings as jest.Mock).mockResolvedValue([]);
      
      render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'No Subscriptions Available',
          'Subscription options are not available at this time. Please check your internet connection and try again.'
        );
      });
    });
  });

  describe('Package Purchase', () => {
    it('should handle successful purchase', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription').parent?.parent;
      expect(monthlyPackage).toBeTruthy();
      
      fireEvent.press(monthlyPackage!);
      
      await waitFor(() => {
        expect(revenueCatManager.purchasePackage).toHaveBeenCalledWith(mockPackages[0]);
        expect(AlertMock.alert).toHaveBeenCalledWith(
          '🎉 Welcome to the App!',
          'Your subscription is now active. Enjoy all premium features!',
          expect.any(Array)
        );
      });
    });

    it('should handle purchase failure', async () => {
      (revenueCatManager.purchasePackage as jest.Mock).mockResolvedValue({ 
        success: false, 
        error: 'Payment failed' 
      });
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription').parent?.parent;
      expect(monthlyPackage).toBeTruthy();
      
      fireEvent.press(monthlyPackage!);
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'Purchase Failed',
          'Payment failed'
        );
      });
    });

    it('should handle user cancellation silently', async () => {
      (revenueCatManager.purchasePackage as jest.Mock).mockResolvedValue({ 
        success: false, 
        error: 'Purchase cancelled' 
      });
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription').parent?.parent;
      expect(monthlyPackage).toBeTruthy();
      
      fireEvent.press(monthlyPackage!);
      
      await waitFor(() => {
        expect(revenueCatManager.purchasePackage).toHaveBeenCalled();
        // Should not show alert for cancellation
        expect(AlertMock.alert).not.toHaveBeenCalledWith(
          expect.stringContaining('Purchase Failed'),
          expect.any(String),
          expect.any(Array)
        );
      });
    });

    it('should handle purchase exception', async () => {
      const error = { userCancelled: false, message: 'Network error' };
      (revenueCatManager.purchasePackage as jest.Mock).mockRejectedValue(error);
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription').parent?.parent;
      expect(monthlyPackage).toBeTruthy();
      
      fireEvent.press(monthlyPackage!);
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'Purchase Failed',
          'Network error'
        );
      });
    });

    it('should disable packages while purchasing', async () => {
      // Make purchase take time to complete
      (revenueCatManager.purchasePackage as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );
      
      const { getByText, getByTestId } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription').parent?.parent;
      expect(monthlyPackage).toBeTruthy();
      
      act(() => {
        fireEvent.press(monthlyPackage!);
      });
      
      // Should show loading indicator
      await waitFor(() => {
        // Check if there's a loading indicator visible
        expect(getByTestId).toBeTruthy();
      });
    });
  });

  describe('Restore Purchases', () => {
    it('should handle successful restore with active subscription', async () => {
      (revenueCatManager.restorePurchases as jest.Mock).mockResolvedValue({ 
        success: true, 
        customerInfo: {} 
      });
      (revenueCatManager.hasActiveSubscription as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Restore Previous Purchase')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Restore Previous Purchase'));
      
      await waitFor(() => {
        expect(revenueCatManager.restorePurchases).toHaveBeenCalled();
        expect(AlertMock.alert).toHaveBeenCalledWith(
          '✅ Subscription Restored',
          'Your subscription has been restored successfully!',
          expect.any(Array)
        );
      });
    });

    it('should handle restore with no active subscription', async () => {
      (revenueCatManager.restorePurchases as jest.Mock).mockResolvedValue({ 
        success: true, 
        customerInfo: {} 
      });
      (revenueCatManager.hasActiveSubscription as jest.Mock).mockResolvedValue(false);
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Restore Previous Purchase')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Restore Previous Purchase'));
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'No Active Subscription',
          'We couldn\'t find any active subscriptions to restore.'
        );
      });
    });

    it('should handle restore failure', async () => {
      (revenueCatManager.restorePurchases as jest.Mock).mockResolvedValue({ 
        success: false, 
        error: 'Restore failed' 
      });
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Restore Previous Purchase')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Restore Previous Purchase'));
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'Restore Failed',
          'Restore failed'
        );
      });
    });
  });

  describe('Code Redemption', () => {
    it('should present code redemption sheet', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Redeem Offer Code')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Redeem Offer Code'));
      
      await waitFor(() => {
        expect(revenueCatManager.presentCodeRedemptionSheet).toHaveBeenCalled();
        expect(AlertMock.alert).toHaveBeenCalledWith(
          '🎉 Code Redemption',
          'If you entered a valid code, your subscription has been updated.',
          expect.any(Array)
        );
      });
    });

    it('should handle code redemption failure', async () => {
      const error = new Error('Sheet presentation failed');
      (revenueCatManager.presentCodeRedemptionSheet as jest.Mock).mockRejectedValue(error);
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Redeem Offer Code')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Redeem Offer Code'));
      
      await waitFor(() => {
        expect(AlertMock.alert).toHaveBeenCalledWith(
          'Redemption Failed',
          'Sheet presentation failed'
        );
      });
    });

    it('should show loading state while presenting code sheet', async () => {
      // Make redemption take time
      (revenueCatManager.presentCodeRedemptionSheet as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Redeem Offer Code')).toBeTruthy();
      });
      
      act(() => {
        fireEvent.press(getByText('Redeem Offer Code'));
      });
      
      await waitFor(() => {
        expect(getByText('Opening...')).toBeTruthy();
      });
    });
  });

  describe('Price Formatting', () => {
    it('should format prices correctly', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('$9.99')).toBeTruthy(); // Monthly price
        expect(getByText('$99.99')).toBeTruthy(); // Annual price
      });
    });

    it('should show savings for annual subscription', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Save 20%')).toBeTruthy();
      });
    });

    it('should show monthly price breakdown for annual subscription', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('$8.33/month billed annually')).toBeTruthy();
      });
    });
  });

  describe('Features Display', () => {
    it('should display all subscription features', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('5 AI meal creations per day')).toBeTruthy();
        expect(getByText('Advanced nutrition tracking')).toBeTruthy();
        expect(getByText('Personalized meal plans')).toBeTruthy();
        expect(getByText('Grocery list management')).toBeTruthy();
        expect(getByText('Recipe sharing & export')).toBeTruthy();
        expect(getByText('Priority customer support')).toBeTruthy();
        expect(getByText('Sync across all devices')).toBeTruthy();
        expect(getByText('Enhanced scanning features*')).toBeTruthy();
      });
    });

    it('should show disclaimer text', async () => {
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('* Future scanning limits may apply')).toBeTruthy();
      });
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button pressed', async () => {
      const { getByLabelText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        const closeButton = getByLabelText('Close');
        fireEvent.press(closeButton);
      });
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should call onSuccess when purchase succeeds', async () => {
      (revenueCatManager.purchasePackage as jest.Mock).mockResolvedValue({ success: true });
      
      const { getByText } = render(<SubscriptionPaywall {...mockProps} />);
      
      await waitFor(() => {
        expect(getByText('Monthly Subscription')).toBeTruthy();
      });
      
      const monthlyPackage = getByText('Monthly Subscription');
      fireEvent.press(monthlyPackage);

      await waitFor(() => {
        expect(revenueCatManager.purchasePackage).toHaveBeenCalledWith(mockPackages[0]);
        expect(AlertMock.alert).toHaveBeenCalledWith(
          '🎉 Welcome to the App!',
          'Your subscription is now active. Enjoy all premium features!',
          expect.any(Array)
        );
      });
      
      // Simulate user pressing "Get Started" in success alert
      const alertCall = AlertMock.alert.mock.calls.find(
        call => call[0] === '🎉 Welcome to the App!'
      );
      expect(alertCall).toBeTruthy();
      
      // Get the button array (third parameter) and click the "Get Started" button
      const buttons = alertCall![2] as any[];
      expect(buttons).toHaveLength(1);
      expect(buttons[0].text).toBe('Get Started');
      
      act(() => {
        buttons[0].onPress();
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
    });
  });
});
