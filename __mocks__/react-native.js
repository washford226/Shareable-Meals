const mockAlert = jest.fn();

const ReactNativeMock = {
  ...jest.requireActual('react-native'),
  Alert: {
    alert: mockAlert,
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
  },
  Platform: {
    OS: 'ios',
  },
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  },
};

// Make sure the Alert mock is available globally for tests
global.Alert = { alert: mockAlert };

module.exports = ReactNativeMock;
