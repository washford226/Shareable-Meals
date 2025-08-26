import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { revenueCatManager } from '../utils/revenueCat';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/usePremium';

const DevSubscriptionToggle: React.FC = () => {
  const { theme } = useTheme();
  const { refreshSubscriptionStatus, hasAppAccess } = useSubscription();

  // Only show in development mode
  if (!__DEV__) {
    return null;
  }

  const handleToggle = async () => {
    revenueCatManager.toggleMockSubscription();
    // Refresh the subscription status after toggle
    setTimeout(() => {
      refreshSubscriptionStatus();
    }, 100);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.warningLight }]}>
      <Text style={[styles.title, { color: theme.warning }]}>
        🛠️ Development Mode
      </Text>
      <Text style={[styles.status, { color: theme.text }]}>
        Subscription: {hasAppAccess ? '✅ Active' : '❌ Inactive'}
      </Text>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleToggle}
      >
        <Text style={[styles.buttonText, { color: theme.buttonText }]}>
          Toggle Subscription
        </Text>
      </TouchableOpacity>
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        This toggle only works in Expo Go for testing
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFA500',
    zIndex: 1000,
    minWidth: 200,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    marginBottom: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  note: {
    fontSize: 10,
    textAlign: 'center',
  },
});

export default DevSubscriptionToggle;
