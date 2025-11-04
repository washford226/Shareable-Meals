// Mock React Native without importing it at all to prevent parsing errors
jest.mock('react-native', () => {
  // Create basic component mocks without external dependencies
  const mockComponent = (name) => {
    const Component = (props) => {
      const mockReact = require('react');
      return mockReact.createElement('div', { ...props, 'data-testid': props.testID || name });
    };
    Component.displayName = name;
    return Component;
  };

  return {
    // Core components
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    ScrollView: mockComponent('ScrollView'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    TouchableHighlight: mockComponent('TouchableHighlight'),
    TouchableWithoutFeedback: mockComponent('TouchableWithoutFeedback'),
    Pressable: mockComponent('Pressable'),
    Image: mockComponent('Image'),
    FlatList: mockComponent('FlatList'),
    SectionList: mockComponent('SectionList'),
    SafeAreaView: mockComponent('SafeAreaView'),
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    Switch: mockComponent('Switch'),
    Modal: mockComponent('Modal'),
    Button: mockComponent('Button'),
    RefreshControl: mockComponent('RefreshControl'),

    // StyleSheet
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => style,
      compose: (style1, style2) => [style1, style2],
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    },

    // Platform
    Platform: {
      OS: 'ios',
      Version: '15.0',
      isPad: false,
      isTVOS: false,
      select: jest.fn((obj) => obj.ios || obj.default),
    },

    // Dimensions
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812, scale: 2, fontScale: 1 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },

    // Alert
    Alert: {
      alert: jest.fn((title, message, buttons, options) => {
        if (buttons && buttons.length > 0) {
          const firstButton = buttons[0];
          if (firstButton.onPress) {
            firstButton.onPress();
          }
        }
      }),
      prompt: jest.fn(),
    },

    // InteractionManager
    InteractionManager: {
      runAfterInteractions: jest.fn((callback) => {
        const handle = setTimeout(() => {
          if (callback) callback();
        }, 0);
        return { cancel: () => clearTimeout(handle) };
      }),
      createInteractionHandle: jest.fn(() => ({})),
      clearInteractionHandle: jest.fn(),
      setDeadline: jest.fn(),
    },

    // Animated
    Animated: {
      View: mockComponent('AnimatedView'),
      Text: mockComponent('AnimatedText'),
      ScrollView: mockComponent('AnimatedScrollView'),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        setOffset: jest.fn(),
        flattenOffset: jest.fn(),
        extractOffset: jest.fn(),
        addListener: jest.fn(() => 'listener-id'),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        stopAnimation: jest.fn(),
        resetAnimation: jest.fn(),
        interpolate: jest.fn(() => ({})),
      })),
      timing: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
      })),
      createAnimatedComponent: jest.fn((Component) => Component),
      event: jest.fn(),
      Easing: {
        linear: jest.fn(),
        ease: jest.fn(),
        quad: jest.fn(),
        cubic: jest.fn(),
        poly: jest.fn(),
        sin: jest.fn(),
        circle: jest.fn(),
        exp: jest.fn(),
        elastic: jest.fn(),
        back: jest.fn(),
        bounce: jest.fn(),
        bezier: jest.fn(),
        in: jest.fn(),
        out: jest.fn(),
        inOut: jest.fn(),
      },
    },

    // NativeModules
    NativeModules: {},

    // AppState
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },

    // StatusBar
    StatusBar: {
      setBarStyle: jest.fn(),
      setBackgroundColor: jest.fn(),
      setTranslucent: jest.fn(),
      setHidden: jest.fn(),
    },

    // DeviceEventEmitter
    DeviceEventEmitter: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      emit: jest.fn(),
    },

    // Keyboard
    Keyboard: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      dismiss: jest.fn(),
    },

    // PanResponder
    PanResponder: {
      create: jest.fn(() => ({
        panHandlers: {},
      })),
    },

    // Share
    Share: {
      share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
    },

    // Linking
    Linking: {
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
      getInitialURL: jest.fn(() => Promise.resolve(null)),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// Mock React Native Gesture Handler
jest.mock('react-native-gesture-handler', () => {
  const mockComponent = (name) => {
    const Component = (props) => {
      const mockReact = require('react');
      return mockReact.createElement('div', { ...props });
    };
    Component.displayName = name;
    return Component;
  };

  return {
    Swipeable: mockComponent('Swipeable'),
    DrawerLayout: mockComponent('DrawerLayout'),
    State: {},
    ScrollView: mockComponent('ScrollView'),
    Slider: mockComponent('Slider'),
    Switch: mockComponent('Switch'),
    TextInput: mockComponent('TextInput'),
    ToolbarAndroid: mockComponent('ToolbarAndroid'),
    ViewPagerAndroid: mockComponent('ViewPagerAndroid'),
    DrawerLayoutAndroid: mockComponent('DrawerLayoutAndroid'),
    WebView: mockComponent('WebView'),
    NativeViewGestureHandler: mockComponent('NativeViewGestureHandler'),
    TapGestureHandler: mockComponent('TapGestureHandler'),
    FlingGestureHandler: mockComponent('FlingGestureHandler'),
    ForceTouchGestureHandler: mockComponent('ForceTouchGestureHandler'),
    LongPressGestureHandler: mockComponent('LongPressGestureHandler'),
    PanGestureHandler: mockComponent('PanGestureHandler'),
    PinchGestureHandler: mockComponent('PinchGestureHandler'),
    RotationGestureHandler: mockComponent('RotationGestureHandler'),
    RawButton: mockComponent('RawButton'),
    BaseButton: mockComponent('BaseButton'),
    RectButton: mockComponent('RectButton'),
    BorderlessButton: mockComponent('BorderlessButton'),
    FlatList: mockComponent('FlatList'),
    gestureHandlerRootHOC: jest.fn(component => component),
    Directions: {},
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Expo modules
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { ...props });
  },
}));

jest.mock('expo-haptics', () => ({
  impact: jest.fn(() => Promise.resolve()),
  notification: jest.fn(() => Promise.resolve()),
  selection: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props) => {
    const mockReact = require('react');
    return mockReact.createElement('div', { ...props, 'data-testid': `icon-${props.name}` });
  },
}));

jest.mock('expo-constants', () => ({
  default: {
    deviceId: 'test-device-id',
    appOwnership: 'expo',
    platform: { ios: { platform: 'ios' } },
  },
  appOwnership: 'expo',
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

// Mock RevenueCat
jest.mock('react-native-purchases', () => ({
  configure: jest.fn(() => Promise.resolve()),
  getOfferings: jest.fn(() => Promise.resolve({ current: null })),
  purchasePackage: jest.fn(() => Promise.resolve({ customerInfo: {}, productIdentifier: 'test' })),
  restorePurchases: jest.fn(() => Promise.resolve({ customerInfo: {} })),
  getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  logIn: jest.fn(() => Promise.resolve({ customerInfo: {}, created: false })),
  logOut: jest.fn(() => Promise.resolve({ customerInfo: {} })),
  setDebugLogsEnabled: jest.fn(),
  canMakePayments: jest.fn(() => Promise.resolve(true)),
  PURCHASE_TYPE: {
    SUBS: 'subs',
    INAPP: 'inapp',
  },
  PRORATION_MODE: {
    UNKNOWN_SUBSCRIPTION_UPGRADE_DOWNGRADE_POLICY: 0,
    IMMEDIATE_WITH_TIME_PRORATION: 1,
    IMMEDIATE_AND_CHARGE_PRORATED_PRICE: 2,
    IMMEDIATE_WITHOUT_PRORATION: 3,
    DEFERRED: 4,
  },
  PACKAGE_TYPE: {
    UNKNOWN: 'UNKNOWN',
    CUSTOM: 'CUSTOM',
    LIFETIME: 'LIFETIME',
    ANNUAL: 'ANNUAL',
    SIX_MONTH: 'SIX_MONTH',
    THREE_MONTH: 'THREE_MONTH',
    TWO_MONTH: 'TWO_MONTH',
    MONTHLY: 'MONTHLY',
    WEEKLY: 'WEEKLY',
  },
}));

// Mock Intl.NumberFormat for consistent test results
Object.defineProperty(global, 'Intl', {
  value: {
    NumberFormat: jest.fn((locale, options) => ({
      format: jest.fn((value) => {
        const currency = options?.currency;
        const isNegative = value < 0;
        const absValue = Math.abs(value);
        let formattedValue;
        let symbol;
        
        switch (currency) {
          case 'USD': symbol = '$'; break;
          case 'EUR': symbol = '€'; break;
          case 'GBP': symbol = '£'; break;
          case 'JPY': symbol = '¥'; break;
          default: symbol = '$';
        }
        
        if (currency === 'JPY') {
          formattedValue = Math.round(absValue).toLocaleString();
        } else {
          const rounded = Math.round(absValue * 100) / 100;
          formattedValue = rounded % 1 === 0 ? 
            `${rounded.toLocaleString()}.00` : 
            rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        return isNegative ? `-${symbol}${formattedValue}` : `${symbol}${formattedValue}`;
      }),
    })),
  },
  configurable: true,
});

// Global test environment setup
global.__DEV__ = true;
global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
global.mockCurrency = 'USD';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
