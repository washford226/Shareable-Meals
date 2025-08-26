import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { revenueCatManager, SubscriptionStatus } from '../utils/revenueCat';
import { PurchasesPackage, PurchasesOfferings } from 'react-native-purchases';

// Helper function to format price
const formatPrice = (price: number, currencyCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(price);
};

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  feature?: string; // Optional feature that triggered the paywall
}

const PremiumPaywall: React.FC<PaywallProps> = ({ visible, onClose, onSuccess, feature }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<PurchasesPackage[] | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [offeringsData, subInfo] = await Promise.all([
        revenueCatManager.getOfferings(),
        revenueCatManager.getSubscriptionStatus()
      ]);
      setOfferings(offeringsData);
      setSubscriptionInfo(subInfo);
    } catch (error) {
      console.error('Error loading paywall data:', error);
      Alert.alert('Error', 'Failed to load subscription options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setPurchasing(packageToPurchase.identifier);
      
      const customerInfo = await revenueCatManager.purchasePackage(packageToPurchase);
      
      Alert.alert(
        '🎉 Welcome to Premium!',
        'Your subscription is now active. Enjoy unlimited access to all premium features!',
        [
          {
            text: 'Get Started',
            onPress: () => {
              onSuccess?.();
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Purchase error:', error);
      
      if (error.userCancelled) {
        // User cancelled - no need to show alert
        return;
      }
      
      Alert.alert(
        'Purchase Failed',
        error.message || 'Unable to complete purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await revenueCatManager.restorePurchases();
      
      // Refresh subscription info
      const updatedSubInfo = await revenueCatManager.getSubscriptionStatus();
      setSubscriptionInfo(updatedSubInfo);
      
      if (updatedSubInfo.isActive) {
        Alert.alert(
          '✅ Purchases Restored',
          'Your premium subscription has been restored successfully!',
          [
            {
              text: 'Continue',
              onPress: () => {
                onSuccess?.();
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions were found to restore.');
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPackage = (pkg: PurchasesPackage, isRecommended = false) => {
    const isPurchasing = purchasing === pkg.identifier;
    const product = pkg.product;
    
    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={[
          styles.packageContainer,
          { 
            backgroundColor: theme.card, 
            borderColor: isRecommended ? theme.primary : theme.border 
          },
          isRecommended && styles.recommendedPackage,
          isPurchasing && { opacity: 0.7 }
        ]}
        onPress={() => handlePurchase(pkg)}
        disabled={isPurchasing || loading}
        activeOpacity={0.8}
      >
        {isRecommended && (
          <View style={[styles.recommendedBadge, { backgroundColor: theme.primary }]}>
            <Text style={[styles.recommendedText, { color: theme.buttonText }]}>
              🏆 MOST POPULAR
            </Text>
          </View>
        )}
        
        <View style={styles.packageHeader}>
          <Text style={[styles.packageTitle, { color: theme.text }]}>
            {pkg.packageType === 'ANNUAL' ? 'Yearly Premium' : 'Monthly Premium'}
          </Text>
          <Text style={[styles.packagePrice, { color: theme.primary }]}>
            {formatPrice(product.price, product.currencyCode)}
          </Text>
        </View>
        
        <Text style={[styles.packageDescription, { color: theme.subtext }]}>
          {pkg.packageType === 'ANNUAL' 
            ? `${formatPrice(product.price / 12, product.currencyCode)}/month • Save ${Math.round(((product.price * 12) - product.price) / (product.price * 12) * 100)}%`
            : 'Per month, billed monthly'
          }
        </Text>
        
        <View style={styles.packageButton}>
          {isPurchasing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.packageButtonText, { color: theme.primary }]}>
              Subscribe Now
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFeatures = () => (
    <View style={[styles.featuresContainer, { backgroundColor: theme.cardSecondary }]}>
      <Text style={[styles.featuresTitle, { color: theme.text }]}>
        🌟 Premium Features
      </Text>
      
      {[
        { icon: '🍽️', title: 'Unlimited Meals', description: 'Create and save as many meals as you want' },
        { icon: '🤖', title: 'AI Meal Generation', description: 'Unlimited AI-powered meal suggestions' },
        { icon: '📊', title: 'Advanced Nutrition', description: 'Detailed macro and micronutrient tracking' },
        { icon: '📤', title: 'Export Data', description: 'Export your meal plans and nutrition data' },
        { icon: '⚡', title: 'Priority Support', description: 'Get help faster with priority customer support' }
      ].map((feature, index) => (
        <View key={index} style={styles.featureItem}>
          <Text style={styles.featureIcon}>{feature.icon}</Text>
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: theme.text }]}>
              {feature.title}
            </Text>
            <Text style={[styles.featureDescription, { color: theme.subtext }]}>
              {feature.description}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={theme.success} />
        </View>
      ))}
    </View>
  );

  if (subscriptionInfo?.isActive) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Premium Active</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.centerContent}>
            <Text style={[styles.activeTitle, { color: theme.success }]}>
              🎉 You're Premium!
            </Text>
            <Text style={[styles.activeDescription, { color: theme.text }]}>
              Enjoy unlimited access to all premium features
            </Text>
            
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.continueButtonText, { color: theme.buttonText }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Upgrade to Premium</Text>
          <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
            <Text style={[styles.restoreText, { color: theme.primary }]}>Restore</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading subscription options...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {feature && (
              <View style={[styles.featureBanner, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                <Ionicons name="star" size={20} color={theme.warning} />
                <Text style={[styles.featureBannerText, { color: theme.text }]}>
                  Upgrade to access {feature}
                </Text>
              </View>
            )}

            {renderFeatures()}

            <View style={styles.packagesContainer}>
              <Text style={[styles.packagesTitle, { color: theme.text }]}>
                Choose Your Plan
              </Text>
              
              {offerings?.map((pkg: PurchasesPackage, index: number) => 
                renderPackage(pkg, pkg.packageType === 'ANNUAL')
              )}
            </View>

            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: theme.subtext }]}>
                • Cancel anytime {'\n'}
                • Secure payment through {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} {'\n'}
                • No ads, no tracking
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 4,
  },
  restoreText: {
    fontSize: 16,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  activeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  activeDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  continueButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  featureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureBannerText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  featuresContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  packagesContainer: {
    padding: 16,
  },
  packagesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  packageContainer: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  recommendedPackage: {
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -60 }],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  packageHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  packageDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  packageButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  packageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PremiumPaywall;
