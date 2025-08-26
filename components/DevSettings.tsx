import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { revenueCatManager } from '../utils/revenueCat';
import { aiUsageTracker } from '../utils/aiUsageTracker';

interface DevSettingsProps {
  visible: boolean;
  onClose: () => void;
}

const DevSettings: React.FC<DevSettingsProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [mockSubscription, setMockSubscription] = useState(false);

  const toggleMockSubscription = () => {
    revenueCatManager.toggleMockSubscription();
    setMockSubscription(!mockSubscription);
  };

  const resetAIUsage = async () => {
    await aiUsageTracker.resetDailyUsage();
    console.log('🔧 Dev: AI usage reset');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            🔧 Developer Settings
          </Text>
          
          <View style={styles.setting}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Mock Subscription
            </Text>
            <Switch
              value={mockSubscription}
              onValueChange={toggleMockSubscription}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={mockSubscription ? theme.buttonText : theme.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={resetAIUsage}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>
              Reset AI Usage
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.text }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    maxWidth: 300,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DevSettings;
