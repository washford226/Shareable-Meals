import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { revenueCatManager, PurchaseResult } from '../utils/revenueCat';
import { PurchasesPackage } from 'react-native-purchases';

interface CustomPaywallProps {
  visible: boolean;
  onDismiss: () => void;
  onPurchaseSuccess: () => void;
}

const CustomPaywall: React.FC<CustomPaywallProps> = ({
  visible,
  onDismiss,
  onPurchaseSuccess,
}) => {
  const { theme } = useTheme();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    try {
      setLoading(true);
      const offerings = await revenueCatManager.getOfferings();
      setPackages(offerings);
    } catch (error) {
      console.error('Error loading offerings:', error);
      Alert.alert(
        'Error',
        'Failed to load subscription options. Please try again.',
        [{ text: 'OK', onPress: onDismiss }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      setPurchasing(packageToPurchase.identifier);
      const result: PurchaseResult = await revenueCatManager.purchasePackage(packageToPurchase);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Thank you for subscribing! You now have access to all features.',
          [{ text: 'OK', onPress: onPurchaseSuccess }]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'Something went wrong');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const result = await revenueCatManager.restorePurchases();
      
      if (result.success) {
        Alert.alert(
          'Restored!',
          'Your subscription has been restored.',
          [{ text: 'OK', onPress: onPurchaseSuccess }]
        );
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      Alert.alert('Restore Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (pkg: PurchasesPackage) => {
    if (pkg.product?.priceString) {
      return pkg.product.priceString;
    }
    if (pkg.product?.price) {
      return `$${pkg.product.price.toFixed(2)}`;
    }
    return 'Price not available';
  };

  const getPackageTitle = (pkg: PurchasesPackage) => {
    if (pkg.product?.title) {
      return pkg.product.title.replace(/\([^)]*\)/g, '').trim();
    }
    if (pkg.packageType) {
      const type = pkg.packageType.toLowerCase();
      if (type.includes('monthly')) return 'Monthly Subscription';
      if (type.includes('annual') || type.includes('yearly')) return 'Annual Subscription';
      if (type.includes('weekly')) return 'Weekly Subscription';
    }
    return pkg.identifier;
  };

  const getPackageDescription = (pkg: PurchasesPackage) => {
    if (pkg.product?.description) {
      return pkg.product.description;
    }
    if (pkg.packageType) {
      const type = pkg.packageType.toLowerCase();
      if (type.includes('monthly')) return '5 AI meal creations per day, billed monthly';
      if (type.includes('annual') || type.includes('yearly')) return '5 AI meal creations per day, billed yearly';
      if (type.includes('weekly')) return '5 AI meal creations per day, billed weekly';
    }
    return 'Unlock premium features including 5 AI meal creations per day';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Subscription Required
          </Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: theme.primary }]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose your subscription plan to access all features
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                Loading subscription options...
              </Text>
            </View>
          ) : packages.length > 0 ? (
            packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.identifier}
                style={[
                  styles.packageCard,
                  { backgroundColor: theme.card, borderColor: theme.border }
                ]}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing !== null}
              >
                <View style={styles.packageInfo}>
                  <Text style={[styles.packageTitle, { color: theme.text }]}>
                    {getPackageTitle(pkg)}
                  </Text>
                  <Text style={[styles.packageDescription, { color: theme.textSecondary }]}>
                    {getPackageDescription(pkg)}
                  </Text>
                  <Text style={[styles.packagePrice, { color: theme.primary }]}>
                    {formatPrice(pkg)}
                  </Text>
                </View>
                {purchasing === pkg.identifier ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.selectButton, { color: theme.primary }]}>
                    Select
                  </Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.text }]}>
                No subscription options available.
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={loadOfferings}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.restoreButton, { borderColor: theme.border }]}
            onPress={handleRestore}
            disabled={loading}
          >
            <Text style={[styles.restoreButtonText, { color: theme.primary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectButton: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  restoreButton: {
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CustomPaywall;
