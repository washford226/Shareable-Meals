import 'react-native-gesture-handler/jestSetup';

// Mock react-native modules
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo modules
jest.mock('expo-constants', () => ({
  default: {
    deviceId: 'test-device-id',
    platform: {
      ios: {
        platform: 'ios',
      },
    },
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(),
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  // Ensure Alert exists and has the alert method
  if (!RN.Alert) {
    RN.Alert = {};
  }
  RN.Alert.alert = jest.fn();
  
  // Ensure Linking exists and has the methods
  if (!RN.Linking) {
    RN.Linking = {};
  }
  RN.Linking.openURL = jest.fn(() => Promise.resolve());
  RN.Linking.canOpenURL = jest.fn(() => Promise.resolve(true));
  
  return RN;
});

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Intl.NumberFormat for consistent test results
Object.defineProperty(global, 'Intl', {
  value: {
    NumberFormat: jest.fn((locale, options) => ({
      format: jest.fn((value) => {
        const currency = options?.currency;
        
        // Handle negative numbers properly
        const isNegative = value < 0;
        const absValue = Math.abs(value);
        
        let formattedValue;
        let symbol;
        
        // Get currency symbol
        switch (currency) {
          case 'USD':
            symbol = '$';
            break;
          case 'EUR':
            symbol = '€';
            break;
          case 'GBP':
            symbol = '£';
            break;
          case 'JPY':
            symbol = '¥';
            break;
          default:
            symbol = '$';
        }
        
        // Format the number based on currency
        if (currency === 'JPY') {
          // JPY doesn't use decimal places
          formattedValue = Math.round(absValue).toLocaleString();
        } else {
          // Round to 2 decimal places for other currencies
          const rounded = Math.round(absValue * 100) / 100;
          
          // Check if it's a whole number
          if (rounded % 1 === 0) {
            formattedValue = `${rounded.toLocaleString()}.00`;
          } else {
            formattedValue = rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        }
        
        // Handle negative sign placement
        if (isNegative) {
          return `-${symbol}${formattedValue}`;
        }
        
        return `${symbol}${formattedValue}`;
      }),
    })),
  },
  configurable: true,
});

// Set default mock currency
global.mockCurrency = 'USD';
