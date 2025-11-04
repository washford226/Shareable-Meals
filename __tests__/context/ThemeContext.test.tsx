import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

// Test component that uses the theme
const TestComponent = () => {
  const { theme, setThemeVariant } = useTheme();
  
  return (
    <>
      <Text testID="background-color">{theme.background}</Text>
      <Text testID="text-color">{theme.text}</Text>
      <Text testID="primary-color">{theme.primary}</Text>
      <Text onPress={() => setThemeVariant('dark')} testID="toggle-button">Toggle</Text>
    </>
  );
};

describe('ThemeContext', () => {
  it('provides light theme by default', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(getByTestId('background-color').props.children).toBe('#FFFFFF');
    expect(getByTestId('text-color').props.children).toBe('#2C3E50');
    expect(getByTestId('primary-color').props.children).toBe('#4A90E2');
  });

  it('provides all required theme properties', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    const backgroundColorText = getByTestId('background-color');
    expect(backgroundColorText.props.children).toBeDefined();
    expect(typeof backgroundColorText.props.children).toBe('string');
    
    const textColorText = getByTestId('text-color');
    expect(textColorText.props.children).toBeDefined();
    expect(typeof textColorText.props.children).toBe('string');
    
    const primaryColorText = getByTestId('primary-color');
    expect(primaryColorText.props.children).toBeDefined();
    expect(typeof primaryColorText.props.children).toBe('string');
  });

  it('provides theme variant setter function', () => {
    const TestToggleComponent = () => {
      const { setThemeVariant } = useTheme();
      return <Text testID="has-setter">{typeof setThemeVariant}</Text>;
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <TestToggleComponent />
      </ThemeProvider>
    );
    
    expect(getByTestId('has-setter').props.children).toBe('function');
  });

  it('works properly when used outside provider (uses default context)', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <Text testID="theme-test">{theme.background}</Text>;
    };

    // This should work because we provide a default context value
    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('theme-test').props.children).toBe('#FFFFFF');
  });

  it('provides consistent theme object structure', () => {
    const ThemeInspector = () => {
      const { theme } = useTheme();
      const requiredKeys = [
        'background',
        'card', 
        'cardSecondary',
        'text',
        'textSecondary',
        'subtext',
        'placeholder',
        'primary',
        'primaryDark',
        'primaryLight',
        'button',
        'buttonSecondary',
        'success',
        'successLight',
        'danger',
        'dangerLight',
        'warning',
        'warningLight',
        'info',
        'infoLight',
        'border',
        'borderDark',
        'divider',
        'shadow',
        'shadowDark'
      ];
      
      const missingKeys = requiredKeys.filter(key => !(key in theme));
      
      return (
        <Text testID="missing-keys">
          {missingKeys.length === 0 ? 'all-present' : missingKeys.join(',')}
        </Text>
      );
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeInspector />
      </ThemeProvider>
    );
    
    expect(getByTestId('missing-keys').props.children).toBe('all-present');
  });

  it('provides font family and font size management', () => {
    const FontTest = () => {
      const { fontFamily, fontSize, setFontFamily, setFontSize } = useTheme();
      return (
        <>
          <Text testID="font-family">{fontFamily}</Text>
          <Text testID="font-size">{fontSize}</Text>
          <Text testID="has-font-setters">{typeof setFontFamily}{typeof setFontSize}</Text>
        </>
      );
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <FontTest />
      </ThemeProvider>
    );
    
    expect(getByTestId('font-family').props.children).toBe('system');
    expect(getByTestId('font-size').props.children).toBe('regular');
    expect(getByTestId('has-font-setters').props.children).toEqual(['function', 'function']);
  });

  it('provides available themes and categories', () => {
    const CategoryTest = () => {
      const { availableThemes, isLightCategory, isDarkCategory } = useTheme();
      return (
        <>
          <Text testID="theme-count">{availableThemes.length}</Text>
          <Text testID="is-light">{isLightCategory.toString()}</Text>
          <Text testID="is-dark">{isDarkCategory.toString()}</Text>
        </>
      );
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <CategoryTest />
      </ThemeProvider>
    );
    
    expect(getByTestId('theme-count').props.children).toBeGreaterThan(0);
    expect(getByTestId('is-light').props.children).toBe('true');
    expect(getByTestId('is-dark').props.children).toBe('false');
  });
});