import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRevenueCat } from '../context/RevenueCatContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Helper function to format price
export const formatPrice = (price: number, currencyCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(price);
};

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

export function Paywall({ visible, onClose, feature }: PaywallProps) {
  const { theme } = useTheme();
  const { packages, purchasePackage, restorePurchases, isLoading } = useRevenueCat();
  const [purchasing, setPurchasing] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(true);

  // Handle initial loading when paywall becomes visible
  React.useEffect(() => {
    if (visible) {
      setPaywallLoading(true);
      // Give RevenueCat time to load packages
      const timer = setTimeout(() => {
        setPaywallLoading(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const premiumFeatures = [
    {
      icon: 'color-palette',
      title: 'Premium Themes',
      description: 'Access to exclusive themes beyond light and dark mode',
    },
    {
      icon: 'text',
      title: 'Custom Fonts',
      description: 'Choose from a variety of beautiful typography options',
    },
    {
      icon: 'bulb',
      title: 'AI Meal Generation',
      description: 'Generate unlimited custom meals with AI assistance',
    },
    {
      icon: 'scan',
      title: 'Meal Scanner',
      description: 'Scan any meal to instantly get nutritional information',
    },
    {
      icon: 'link',
      title: 'URL Meal Creation',
      description: 'Create meals from recipe URLs with smart extraction',
    },
    {
      icon: 'remove-circle',
      title: 'Ad-Free Experience',
      description: 'Enjoy the app without any advertisements',
    },
  ];

  const handleUpgrade = async () => {
    // Show loading state while checking packages
    if (paywallLoading || isLoading) {
      Alert.alert(
        'Loading...', 
        'Please wait while we load subscription options.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!packages || packages.length === 0) {
      Alert.alert(
        'Connection Issue', 
        'Unable to load subscription plans. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: () => window.location.reload() },
          { text: 'Close', onPress: onClose }
        ]
      );
      return;
    }

    try {
      setPurchasing(true);
      console.log('Available packages:', packages.length);
      console.log('Attempting purchase with package:', packages[0]);
      
      // Use the first available package
      const packageToPurchase = packages[0];
      const success = await purchasePackage(packageToPurchase);
      
      if (success) {
        Alert.alert(
          'Welcome to Premium!', 
          'You now have access to all premium features!',
          [{ 
            text: 'Awesome!', 
            onPress: onClose 
          }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Purchase Failed', 
        'There was an issue with your purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await restorePurchases();
    } finally {
      setPurchasing(false);
    }
  };

  // Get the first package for display
  const primaryPackage = packages && packages.length > 0 ? packages[0] : null;
  const product = primaryPackage?.product;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.cardSecondary }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Hero Section */}
          <LinearGradient
            colors={[theme.primary, theme.primary + '80']}
            style={styles.heroSection}
          >
            <Ionicons name="star" size={48} color="white" />
            <Text style={styles.heroTitle}>Upgrade to Premium</Text>
            <Text style={styles.heroSubtitle}>
              Unlock all features and enjoy an ad-free experience
            </Text>
            {feature && (
              <Text style={styles.featureCallout}>
                You need Premium to use {feature}
              </Text>
            )}
          </LinearGradient>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, { color: theme.text }]}>
              Premium Features
            </Text>
            {premiumFeatures.map((feature, index) => (
              <View
                key={index}
                style={[styles.featureItem, { backgroundColor: theme.card }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name={feature.icon as any} size={24} color={theme.primary} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: theme.text }]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.featureDescription, { color: theme.textSecondary }]}>
                    {feature.description}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              </View>
            ))}
          </View>

          {/* Pricing */}
          <View style={styles.pricingContainer}>
            {paywallLoading || isLoading ? (
              <View style={[styles.pricingCard, { backgroundColor: theme.card }]}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Loading subscription options...
                  </Text>
                </View>
              </View>
            ) : packages && packages.length > 0 ? (
              <View style={[styles.pricingCard, { backgroundColor: theme.card }]}>
                <View style={styles.pricingHeader}>
                  <Text style={[styles.pricingTitle, { color: theme.text }]}>
                    Premium Plan
                  </Text>
                </View>
                <View style={styles.pricingPrice}>
                  <Text style={[styles.priceAmount, { color: theme.text }]}>
                    {product && product.price !== undefined && product.currencyCode
                      ? formatPrice(product.price, product.currencyCode)
                      : 'Loading...'
                    }
                  </Text>
                  <Text style={[styles.pricePeriod, { color: theme.textSecondary }]}>
                    {primaryPackage?.packageType === 'ANNUAL' ? '/year' : '/month'}
                  </Text>
                </View>
                <Text style={[styles.pricingDescription, { color: theme.textSecondary }]}>
                  Full access to all premium features
                </Text>
              </View>
            ) : (
              <View style={[styles.pricingCard, { backgroundColor: theme.card }]}>
                <View style={styles.errorContainer}>
                  <Ionicons name="warning" size={32} color={theme.warning || '#FFA500'} />
                  <Text style={[styles.errorTitle, { color: theme.text }]}>
                    Connection Issue
                  </Text>
                  <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                    Unable to load subscription options.{'\n'}
                    Please check your internet connection.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Upgrade Button */}
        <View style={[styles.footer, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[
              styles.upgradeButton, 
              { 
                backgroundColor: (purchasing || isLoading || paywallLoading || !packages || packages.length === 0) 
                  ? theme.textSecondary 
                  : theme.primary,
                opacity: (purchasing || isLoading || paywallLoading || !packages || packages.length === 0) 
                  ? 0.7 
                  : 1
              }
            ]}
            onPress={handleUpgrade}
            disabled={purchasing || isLoading || paywallLoading || !packages || packages.length === 0}
          >
            {purchasing ? (
              <ActivityIndicator color={theme.buttonTextPrimary} size="small" />
            ) : paywallLoading || isLoading ? (
              <Text style={[styles.upgradeButtonText, { color: theme.buttonTextPrimary }]}>
                Loading...
              </Text>
            ) : packages && packages.length > 0 ? (
              <Text style={[styles.upgradeButtonText, { color: theme.buttonTextPrimary }]}>
                {product && product.price !== undefined && product.currencyCode
                  ? `Start Premium - ${formatPrice(product.price, product.currencyCode)}${primaryPackage?.packageType === 'ANNUAL' ? '/year' : '/month'}`
                  : 'Start Premium'
                }
              </Text>
            ) : (
              <Text style={[styles.upgradeButtonText, { color: theme.buttonTextPrimary }]}>
                Retry Connection
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Restore Purchases Button */}
          <TouchableOpacity
            style={[styles.restoreButton]}
            onPress={handleRestore}
            disabled={purchasing || isLoading}
          >
            <Text style={[styles.restoreButtonText, { color: theme.primary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
            Cancel anytime. No commitments.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  featureCallout: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.95,
  },
  featuresContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  pricingContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  pricingCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  popularBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  pricingPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  pricePeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  pricingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  upgradeButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});