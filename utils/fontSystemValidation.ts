/**
 * Font System Validation Script
 * 
 * This script helps validate that the font system is working correctly
 * by testing the responsive font scaling across different screen sizes.
 */

import { Dimensions } from 'react-native';

// Simulate different screen sizes for testing
const testScreenSizes = [
  { width: 320, name: 'iPhone 5 (Very Small)' },
  { width: 375, name: 'iPhone SE (Small)' },
  { width: 390, name: 'iPhone 12 (Medium)' },
  { width: 414, name: 'iPhone 11 Pro Max (Large)' },
  { width: 430, name: 'iPhone 14 Pro Max (Extra Large)' },
  { width: 768, name: 'iPad (Tablet)' },
  { width: 1024, name: 'iPad Pro (Large Tablet)' },
];

// Test font scaling function (copy from utils/responsiveUtils.ts for testing)
const testScaleFont = (size: number, screenWidth: number): number => {
  if (screenWidth < 350) {
    return Math.round(size * 0.85); // 15% smaller
  } else if (screenWidth < 375) {
    return Math.round(size * 0.90); // 10% smaller
  } else if (screenWidth < 414) {
    return size; // Base size
  } else if (screenWidth < 500) {
    return Math.round(size * 1.05); // 5% larger
  } else if (screenWidth < 768) {
    return Math.round(size * 1.10); // 10% larger
  } else {
    return Math.round(size * 1.15); // 15% larger
  }
};

// Test theme font sizes
const baseFontSizes = {
  tiny: 11,
  caption: 12,
  footnote: 13,
  subheadline: 14,
  callout: 15,
  body: 16,
  headline: 17,
  title3: 19,
  title2: 21,
  title1: 27,
  largeTitle: 33,
};

// Generate test results
const validateFontSystem = () => {
  console.log('=== Font System Validation ===\n');
  
  testScreenSizes.forEach(device => {
    console.log(`Device: ${device.name} (${device.width}px)`);
    console.log('Font Size Scaling:');
    
    Object.entries(baseFontSizes).forEach(([fontType, baseSize]) => {
      const scaledSize = testScaleFont(baseSize, device.width);
      const scaleFactor = ((scaledSize / baseSize - 1) * 100).toFixed(1);
      const sign = parseFloat(scaleFactor) > 0 ? '+' : '';
      console.log(`  ${fontType.padEnd(12)}: ${baseSize}px → ${scaledSize}px (${sign}${scaleFactor}%)`);
    });
    console.log('');
  });

  // Test font family mapping
  console.log('=== Font Family Mapping ===');
  console.log('System Font: "System"');
  console.log('SpaceMono Font: "SpaceMono-Regular"');
  console.log('');

  // Test responsive breakpoints
  console.log('=== Responsive Breakpoints ===');
  console.log('Very Small (< 350px): 85% of base size');
  console.log('Small (350-375px): 90% of base size');
  console.log('Medium (375-414px): 100% of base size (baseline)');
  console.log('Large (414-500px): 105% of base size');
  console.log('Extra Large (500-768px): 110% of base size');
  console.log('Tablet (768px+): 115% of base size');
  console.log('');

  // Test common migration scenarios
  console.log('=== Common Font Size Migrations ===');
  const commonLegacySizes = [10, 12, 14, 16, 18, 20, 24, 28];
  const fontTypeMap: { [key: number]: string } = {
    10: 'tiny',
    12: 'caption',
    14: 'subheadline', 
    16: 'body',
    18: 'headline',
    20: 'title3',
    24: 'title2', 
    28: 'title1'
  };

  commonLegacySizes.forEach(legacySize => {
    const recommendedType = fontTypeMap[legacySize] || 'custom';
    console.log(`Legacy fontSize: ${legacySize} → theme.fonts.${recommendedType}`);
  });
};

// Run validation
export { validateFontSystem };

// Usage instructions
console.log(`
To test the font system:

1. Import this validation in a test component
2. Call validateFontSystem() to see scaling results
3. Test on different devices to verify responsive behavior

Example component usage:
\`\`\`tsx
import { useTheme } from '../context/ThemeContext';

const TestComponent = () => {
  const { theme } = useTheme();
  
  return (
    <View>
      <Text style={{ fontSize: theme.fonts.largeTitle, fontFamily: theme.fontFamily.heading }}>
        Large Title
      </Text>
      <Text style={{ fontSize: theme.fonts.body, fontFamily: theme.fontFamily.body }}>
        Body text that scales responsively
      </Text>
    </View>
  );
};
\`\`\`
`);