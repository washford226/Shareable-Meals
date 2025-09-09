import 'react-native-gesture-handler/jestSetup';

// Mock React Native Alert first
const mockAlert = jest.fn();
global.Alert = { alert: mockAlert };

// Mock react-native modules
jest.mock('react-native', () => ({
  Alert: global.Alert,
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
  },
  Platform: {
    OS: 'ios',
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(styles => styles),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
}));

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

// Mock Expo vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons'
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

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

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    syncPurchases: jest.fn(() => Promise.resolve()),
    getOfferings: jest.fn(() => Promise.resolve({ all: {}, current: null })),
    restorePurchases: jest.fn(() => Promise.resolve()),
    purchasePackage: jest.fn(() => Promise.resolve()),
    presentCodeRedemptionSheet: jest.fn(() => Promise.resolve()),
    getCustomerInfo: jest.fn(() => Promise.resolve({
      entitlements: { active: {}, all: {} },
      activeSubscriptions: []
    })),
    setAttributes: jest.fn(() => Promise.resolve()),
    logIn: jest.fn(() => Promise.resolve()),
    logOut: jest.fn(() => Promise.resolve()),
  },
  PURCHASES_ERROR_CODE: {
    USER_CANCELLED: 'UserCancelledError',
    PURCHASE_NOT_ALLOWED: 'PurchaseNotAllowedError',
    PRODUCT_NOT_AVAILABLE: 'ProductNotAvailableError',
    PAYMENT_PENDING: 'PaymentPendingError',
    NETWORK_ERROR: 'NetworkError',
    PURCHASE_INVALID: 'PurchaseInvalidError',
    UNKNOWN_ERROR: 'UnknownError',
  },
  LOG_LEVEL: {
    VERBOSE: 'VERBOSE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
  PurchasesOffering: jest.fn(),
  PurchasesPackage: jest.fn(),
  CustomerInfo: jest.fn(),
  PurchasesError: jest.fn(),
}));
