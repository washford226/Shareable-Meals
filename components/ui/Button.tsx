import React, { memo, useCallback, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

const Button: React.FC<ButtonProps> = memo(({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  onPress,
  disabled,
  style,
  textStyle,
  hapticFeedback = true,
  ...rest
}) => {
  const { theme } = useTheme();
  const [pressing, setPressing] = useState(false);

  const handlePressIn = useCallback(() => {
    setPressing(true);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticFeedback]);

  const handlePressOut = useCallback(() => {
    setPressing(false);
  }, []);

  const handlePress = useCallback((event: any) => {
    if (!disabled && !loading && onPress) {
      onPress(event);
    }
  }, [disabled, loading, onPress]);

  // Get variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? theme.borderDark : theme.primary,
          borderColor: disabled ? theme.borderDark : theme.primary,
          borderWidth: 0,
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? theme.borderDark : theme.cardSecondary,
          borderColor: disabled ? theme.borderDark : theme.border,
          borderWidth: 1,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: disabled ? theme.borderDark : theme.primary,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'danger':
        return {
          backgroundColor: disabled ? theme.borderDark : theme.danger,
          borderColor: disabled ? theme.borderDark : theme.danger,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: theme.primary,
          borderColor: theme.primary,
          borderWidth: 0,
        };
    }
  };

  // Get text color
  const getTextColor = () => {
    if (disabled) {
      return theme.textSecondary;
    }
    
    switch (variant) {
      case 'primary':
      case 'danger':
        return theme.buttonTextPrimary;
      case 'secondary':
        return theme.text;
      case 'outline':
        return theme.primary;
      case 'ghost':
        return theme.text;
      default:
        return theme.buttonTextPrimary;
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
        };
      case 'medium':
        return {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 8,
        };
      case 'large':
        return {
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderRadius: 10,
        };
      default:
        return {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 8,
        };
    }
  };

  // Get icon size
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 18;
      case 'large':
        return 20;
      default:
        return 18;
    }
  };

  // Get font size
  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const textColor = getTextColor();
  const iconSize = getIconSize();
  const fontSize = getFontSize();

  return (
    <TouchableOpacity
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        variantStyles,
        sizeStyles,
        fullWidth && styles.fullWidth,
        pressing && styles.pressing,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {leftIcon && (
              <Ionicons
                name={leftIcon}
                size={iconSize}
                color={textColor}
                style={styles.leftIcon}
              />
            )}
            <Text
              style={[
                styles.text,
                { color: textColor, fontSize },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {rightIcon && (
              <Ionicons
                name={rightIcon}
                size={iconSize}
                color={textColor}
                style={styles.rightIcon}
              />
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  pressing: {
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});

export default Button;