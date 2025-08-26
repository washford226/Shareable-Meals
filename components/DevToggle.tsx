import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import DevSettings from './DevSettings';

interface DevToggleProps {
  show?: boolean;
}

const DevToggle: React.FC<DevToggleProps> = ({ show = __DEV__ }) => {
  const { theme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  if (!show) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.devButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowSettings(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.devButtonText, { color: theme.buttonText }]}>
          🔧
        </Text>
      </TouchableOpacity>
      
      <DevSettings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  devButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  devButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default DevToggle;
