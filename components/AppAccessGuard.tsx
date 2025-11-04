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
    error,
    refreshSubscriptionStatus,
    getSubscriptionStatusText 
  } = useSubscription();
  
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Add timeout for loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('⏰ Subscription check timed out, allowing access in development');
        setHasTimedOut(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    // Show paywall if user doesn't have access after loading (but not in development mode)
    if (!isLoading && !hasAppAccess && !__DEV__ && !hasTimedOut) {
      setShowPaywall(true);
    }
  }, [isLoading, hasAppAccess, hasTimedOut]);

  const handleSubscriptionSuccess = () => {
    setShowPaywall(false);
    refreshSubscriptionStatus();
  };

  const handleRetryConnection = () => {
    setHasTimedOut(false);
    refreshSubscriptionStatus();
  };

  // Show loading screen while checking subscription (unless timed out)
  if (isLoading && !hasTimedOut) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Checking subscription status...
        </Text>
        {error && (
          <TouchableOpacity 
            style={[styles.skipButton, { backgroundColor: theme.primary }]}
            onPress={handleRetryConnection}
          >
            <Text style={[styles.skipButtonText, { color: '#FFFFFF' }]}>
              Skip & Continue
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show trial warning if in trial period
  if (hasAppAccess && accessReason === 'trial' && daysRemaining !== undefined && daysRemaining <= 3) {
    // You can add a trial warning banner here if needed
  }

  // If user has access, we're in development mode, or we've timed out, show the app content
  if (hasAppAccess || __DEV__ || hasTimedOut) {
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
  skipButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
