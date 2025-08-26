import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/usePremium';
import { revenueCatManager } from '../utils/revenueCat';
import SubscriptionPaywall from './SubscriptionPaywall';

interface AppAccessGuardProps {
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
}

const AppAccessGuard: React.FC<AppAccessGuardProps> = ({ 
  children, 
  fallbackComponent 
}) => {
  const { theme } = useTheme();
  const { 
    isLoading, 
    hasAppAccess, 
    accessReason, 
    daysRemaining,
    refreshSubscriptionStatus,
    getSubscriptionStatusText 
  } = useSubscription();
  
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    // Show paywall if user doesn't have access after loading (but not in development mode)
    if (!isLoading && !hasAppAccess && !__DEV__) {
      setShowPaywall(true);
    }
  }, [isLoading, hasAppAccess]);

  const handleSubscriptionSuccess = () => {
    setShowPaywall(false);
    refreshSubscriptionStatus();
  };

  // Show loading screen while checking subscription
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Checking subscription status...
        </Text>
      </View>
    );
  }

  // Show trial warning if in trial period
  if (hasAppAccess && accessReason === 'trial' && daysRemaining !== undefined && daysRemaining <= 3) {
    // You can add a trial warning banner here if needed
  }

  // If user has access or we're in development mode, show the app content
  if (hasAppAccess || __DEV__) {
    return <>{children}</>;
  }

  // Show fallback component if provided, otherwise show subscription paywall
  if (fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  return (
    <View style={[styles.paywallContainer, { backgroundColor: theme.background }]}>
      <SubscriptionPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={handleSubscriptionSuccess}
        allowClose={false}
        title="Subscription Required"
        subtitle="This app requires an active subscription to access all features."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  paywallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  fallbackMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AppAccessGuard;
