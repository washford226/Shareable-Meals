import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useRevenueCat } from '../context/RevenueCatContext';
import { useTheme } from '../context/ThemeContext';
import { SubscriptionDB } from '../utils/subscriptionDB';

export function RevenueCatDebug() {
  const { 
    isPremium, 
    isLoading, 
    packages, 
    customerInfo, 
    purchasePackage, 
    restorePurchases,
    checkPremiumStatus 
  } = useRevenueCat();
  
  const { theme } = useTheme();
  const [dbSubscription, setDbSubscription] = useState<any>(null);
  const [dbPremiumStatus, setDbPremiumStatus] = useState<boolean>(false);
  
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    loadDatabaseInfo();
  }, []);

  const loadDatabaseInfo = async () => {
    try {
      const subscription = await SubscriptionDB.getSubscriptionDetails();
      const premiumStatus = await SubscriptionDB.checkPremiumStatus();
      setDbSubscription(subscription);
      setDbPremiumStatus(premiumStatus);
    } catch (error) {
      console.error('Error loading database info:', error);
    }
  };

  const handleTestPurchase = async () => {
    if (packages.length === 0) {
      Alert.alert('No packages available');
      return;
    }
    
    const success = await purchasePackage(packages[0]);
    Alert.alert(success ? 'Purchase successful!' : 'Purchase failed');
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    Alert.alert(success ? 'Purchases restored!' : 'No purchases to restore');
  };

  const handleRefresh = async () => {
    await checkPremiumStatus();
    await loadDatabaseInfo();
    Alert.alert('Status refreshed');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>RevenueCat Debug</Text>
      
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Environment</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Running in: {isExpoGo ? '📱 Expo Go' : '📦 Development Build'}
        </Text>
        {isExpoGo && (
          <Text style={[styles.warning, { color: theme.danger }]}>
            ⚠️ RevenueCat purchases are limited in Expo Go. Use a development build for full functionality.
          </Text>
        )}
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>RevenueCat Status</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Premium (RC): {isPremium ? '✅ Active' : '❌ Not Active'}
        </Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Loading: {isLoading ? '⏳ Yes' : '✅ No'}
        </Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Packages Available: {packages.length}
        </Text>
        {isExpoGo && (
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            (Packages disabled in Expo Go)
          </Text>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Database Status</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Premium (DB): {dbPremiumStatus ? '✅ Active' : '❌ Not Active'}
        </Text>
        {dbSubscription && (
          <>
            <Text style={[styles.text, { color: theme.text }]}>
              Product ID: {dbSubscription.product_id || 'None'}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              Is Trial: {dbSubscription.is_trial ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              Will Renew: {dbSubscription.will_renew ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              Expires: {dbSubscription.expiration_date ? 
                new Date(dbSubscription.expiration_date).toLocaleDateString() : 'Never'}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              RC User ID: {dbSubscription.revenue_cat_user_id || 'None'}
            </Text>
          </>
        )}
        {!dbSubscription && (
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            No subscription record in database
          </Text>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Available Packages</Text>
        {packages.map((pkg, index) => (
          <View key={index} style={styles.packageItem}>
            <Text style={[styles.text, { color: theme.text }]}>
              ID: {pkg.identifier}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              Product: {pkg.product?.identifier}
            </Text>
            <Text style={[styles.text, { color: theme.text }]}>
              Price: {pkg.product?.priceString || 'Unknown'}
            </Text>
          </View>
        ))}
        {packages.length === 0 && (
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            No packages loaded
          </Text>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer Info</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          User ID: {customerInfo?.originalAppUserId || 'Not set'}
        </Text>
        <Text style={[styles.text, { color: theme.text }]}>
          Active Entitlements: {Object.keys(customerInfo?.entitlements.active || {}).join(', ') || 'None'}
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Test Actions</Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleTestPurchase}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: theme.buttonTextPrimary }]}>
            Test Purchase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.secondary }]}
          onPress={handleRestore}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: 'white' }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={handleRefresh}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: 'white' }]}>
            Refresh Status
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    marginBottom: 8,
  },
  warning: {
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  packageItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 8,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});