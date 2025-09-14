import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { revenueCatManager, SubscriptionStatus } from '../utils/revenueCat';
import { PurchasesPackage } from 'react-native-purchases';

// Helper function to format price
export const formatPrice = (price: number, currencyCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(price);
};

interface SubscriptionPaywallProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  allowClose?: boolean; // If false, user must subscribe to continue
  title?: string;
  subtitle?: string;
}

const SubscriptionPaywall: React.FC<SubscriptionPaywallProps> = ({ 
  visible, 
  onClose, 
  onSuccess,
  allowClose = true,
  title = "Subscribe to Continue",
  subtitle = "Unlock premium features and enhanced meal planning"
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesPackage[] | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [presentingCodeSheet, setPresentingCodeSheet] = useState(false);

  useEffect(() => {
    if (visible) {
      loadOfferingsAndStatus();
    }
  }, [visible]);

  const loadOfferingsAndStatus = async () => {
    try {
      setLoading(true);
      const [offeringsData, statusData] = await Promise.all([
        revenueCatManager.getOfferings(),
        revenueCatManager.getSubscriptionStatus()
      ]);
      
      setOfferings(offeringsData);
      setSubscriptionStatus(statusData);
      
      // Check if no offerings are available
      if (!offeringsData || offeringsData.length === 0) {
        Alert.alert(
          'No Subscriptions Available',
          'Subscription options are not available at this time. Please check your internet connection and try again.'
        );
      }
    } catch (error) {
      console.error('Error loading paywall data:', error);
      Alert.alert(
        'Connection Error', 
        'Failed to load subscription options. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchasing(pkg.identifier);
      
      const result = await revenueCatManager.purchasePackage(pkg);
      
      if (result.success) {
        Alert.alert(
          '🎉 Welcome to the App!',
          'Your subscription is now active. Enjoy all premium features!',
          [
            {
              text: 'Get Started',
              onPress: () => {
                onSuccess?.();
              }
            }
          ]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      
      const result = await revenueCatManager.restorePurchases();
      
      if (result.success && result.customerInfo) {
        const hasActiveSubscription = await revenueCatManager.hasActiveSubscription();
        
        if (hasActiveSubscription) {
          Alert.alert(
            '✅ Subscription Restored',
            'Your subscription has been restored successfully!',
            [
              {
                text: 'Continue',
                onPress: () => {
                  onSuccess?.();
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'No Active Subscription',
            'We couldn\'t find any active subscriptions to restore.'
          );
        }
      } else {
        Alert.alert(
          'Restore Failed',
          result.error || 'Failed to restore purchases. Please try again.'
        );
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      Alert.alert('Restore Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresentCodeRedemption = async () => {
    try {
      setPresentingCodeSheet(true);

      // Get subscription status before redemption attempt
      const statusBefore = await revenueCatManager.getSubscriptionStatus();

      // Opens Apple's native code redemption UI (iOS 14+ only).
      await revenueCatManager.presentCodeRedemptionSheet();

      // Get subscription status after redemption attempt
      const statusAfter = await revenueCatManager.getSubscriptionStatus();

      // Check if subscription status changed (indicating successful redemption)
      const wasSuccessful = !statusBefore.isActive && statusAfter.isActive;

      if (wasSuccessful) {
        // User successfully redeemed a code and now has an active subscription
        Alert.alert(
          '🎉 Code Redeemed Successfully!',
          'Your subscription is now active. Enjoy all premium features!',
          [
            {
              text: 'Get Started',
              onPress: () => {
                onSuccess?.();
              }
            }
          ]
        );
      } else {
        // User either cancelled or the code was invalid/already used
        // Don't call onSuccess - keep them on the paywall
        if (statusAfter.isActive) {
          // They already had an active subscription
          Alert.alert(
            'Already Subscribed',
            'You already have an active subscription!',
            [
              {
                text: 'Continue',
                onPress: () => {
                  onSuccess?.();
                }
              }
            ]
          );
        }
        // If no subscription and no change, user likely cancelled - no alert needed
      }
    } catch (error: any) {
      console.error('Code redemption error:', error);
      Alert.alert(
        'Redemption Failed',
        error.message || 'Failed to open the code redemption sheet. Please try again.'
      );
    } finally {
      setPresentingCodeSheet(false);
    }
  };

  const renderPackage = (pkg: PurchasesPackage, isPopular: boolean = false) => {
    const product = pkg.product;
    const isPurchasing = purchasing === pkg.identifier;
    
    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={[
          styles.packageContainer,
          { 
            backgroundColor: theme.card,
            borderColor: isPopular ? theme.primary : theme.border,
            borderWidth: isPopular ? 2 : 1,
          },
          isPurchasing && { opacity: 0.7 }
        ]}
        onPress={() => handlePurchase(pkg)}
        disabled={isPurchasing || loading}
      >
        {isPopular && (
          <View style={[styles.popularBadge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.popularBadgeText, { color: theme.buttonText }]}>
              Most Popular
            </Text>
          </View>
        )}
        
        <View style={styles.packageContent}>
          <Text style={[styles.packageTitle, { color: theme.text }]}>
            {pkg.packageType === 'ANNUAL' ? 'Annual Subscription' : 
             pkg.packageType === 'MONTHLY' ? 'Monthly Subscription' : 
             pkg.product.title}
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={[styles.packagePrice, { color: theme.primary }]}>
              {formatPrice(product.price, product.currencyCode)}
            </Text>
            {pkg.packageType === 'ANNUAL' && (
              <Text style={[styles.packageSavings, { color: theme.success }]}>
                Save 20%
              </Text>
            )}
          </View>
          
          {pkg.packageType === 'ANNUAL' && (
            <Text style={[styles.packageDescription, { color: theme.textSecondary }]}>
              {formatPrice(product.price / 12, product.currencyCode)}/month billed annually
            </Text>
          )}
        </View>
        
        {isPurchasing ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={allowClose ? onClose : undefined}
      testID="subscription-paywall-modal"
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={styles.header}>
          {allowClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.text }]}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Features List */}
          <View style={[styles.featuresContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.featuresTitle, { color: theme.text }]}>
              What's Included:
            </Text>
            
            {[
              '5 AI meal creations per day',
              'Advanced nutrition tracking',
              'Personalized meal plans',
              'Grocery list management',
              'Recipe sharing & export',
              'Priority customer support',
              'Sync across all devices',
              'Enhanced scanning features*'
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text style={[styles.featureText, { color: theme.text }]}>
                  {feature}
                </Text>
              </View>
            ))}
            
            <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
              * Future scanning limits may apply
            </Text>
          </View>

          {/* Subscription Options */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading subscription options...
              </Text>
            </View>
          ) : (
            <View style={styles.packagesContainer}>
              <Text style={[styles.packagesTitle, { color: theme.text }]}>
                Choose Your Plan:
              </Text>
              
              {offerings?.map((pkg: PurchasesPackage, index: number) => 
                renderPackage(pkg, pkg.packageType === 'ANNUAL')
              )}
            </View>
          )}

          {/* Restore Button */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={loading}
          >
            <Text style={[styles.restoreButtonText, { color: theme.primary }]}>
              Restore Previous Purchase
            </Text>
          </TouchableOpacity>

          {/* Offer Code Section */}
          <View style={styles.offerCodeSection}>
            <TouchableOpacity
              style={[
                styles.offerCodeButton,
                { borderColor: theme.border },
                presentingCodeSheet && { opacity: 0.5 }
              ]}
              onPress={handlePresentCodeRedemption}
              disabled={loading || presentingCodeSheet}
            >
              {presentingCodeSheet ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="gift" size={16} color={theme.primary} />
              )}
              <Text style={[styles.offerCodeButtonText, { color: theme.primary }]}>
                {presentingCodeSheet ? 'Opening...' : 'Redeem Offer Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={[styles.termsText, { color: theme.textSecondary }]}>
              Subscriptions auto-renew unless cancelled. Cancel anytime in your account settings.{'\n'}
              By subscribing, you agree to our{' '}
              <Text 
                style={[styles.linkText, { color: theme.primary }]}
                onPress={async () => {
                  try {
                    const url = 'https://www.shareablemeals.com/terms';
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'Unable to open Terms of Use. Please check your internet connection.');
                    }
                  } catch (error) {
                    console.error('Error opening Terms of Use:', error);
                    Alert.alert('Error', 'Unable to open Terms of Use. Please try again.');
                  }
                }}
              >
                Terms of Use
              </Text>{' '}
              and{' '}
              <Text 
                style={[styles.linkText, { color: theme.primary }]}
                onPress={async () => {
                  try {
                    const url = 'https://www.shareablemeals.com/privacy';
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'Unable to open Privacy Policy. Please check your internet connection.');
                    }
                  } catch (error) {
                    console.error('Error opening Privacy Policy:', error);
                    Alert.alert('Error', 'Unable to open Privacy Policy. Please try again.');
                  }
                }}
              >
                Privacy Policy
              </Text>.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  packagesContainer: {
    marginBottom: 24,
  },
  packagesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  packageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageContent: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
  },
  packageSavings: {
    fontSize: 14,
    fontWeight: '600',
  },
  packageDescription: {
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 24,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Offer Code Styles (Apple native redemption)
  offerCodeSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  offerCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  offerCodeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  termsContainer: {
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  linkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  disclaimerText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'left',
    marginTop: 8,
    paddingLeft: 28,
  },
});

export default SubscriptionPaywall;
