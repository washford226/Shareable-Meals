import React, { memo, useCallback, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator, Animated } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";
import { getBottomNavHeight, getBottomNavIconSize, getBottomNavFontSize, getDeviceCategory } from "../utils/responsiveUtils";
import * as Haptics from 'expo-haptics';

// Device category helper
const deviceCategory = getDeviceCategory();
const isSmallDevice = deviceCategory === 'extraSmall' || deviceCategory === 'small';

const BottomNav = memo(() => {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  const navItems = [
    {
      id: 'calendar',
      route: '/(app)/meal-plan/calendar',
      icon: 'calendar',
      activeIcon: 'calendar',
      label: 'Calendar',
      isActive: pathname?.includes('/meal-plan/'),
    },
    {
      id: 'my-meals',
      route: '/(app)/my-meals/meals',
      icon: 'restaurant-outline',
      activeIcon: 'restaurant',
      label: 'My Meals',
      isActive: pathname?.includes('/my-meals/'),
    },
    {
      id: 'discover',
      route: '/(app)/other-meals/other-meals',
      icon: 'search-outline',
      activeIcon: 'search',
      label: 'Discover',
      isActive: pathname?.includes('/other-meals/'),
    },
    {
      id: 'account',
      route: '/(app)/account/account',
      icon: 'person-outline',
      activeIcon: 'person',
      label: 'Account',
      isActive: pathname?.includes('/account/'),
    },
  ];

  // Animation values for visual feedback
  const scaleAnimations = navItems.reduce((acc, item) => {
    acc[item.id] = new Animated.Value(1);
    return acc;
  }, {} as Record<string, Animated.Value>);

  const handleNavPress = useCallback((route: string, id: string) => {
    // Prevent double navigation
    if (navigatingTo === id) return;
    
    // Haptic feedback for better user experience
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Android selection feedback
      Haptics.selectionAsync();
    }
    
    // Visual feedback animation
    const scaleAnim = scaleAnimations[id];
    if (scaleAnim) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    setNavigatingTo(id);
    setPressedItem(id);
    
    // Navigate immediately without waiting
    router.push(route as any);
    
    // Clear loading state quickly for visual feedback
    setTimeout(() => {
      setNavigatingTo(null);
      setPressedItem(null);
    }, 300);
  }, [navigatingTo, scaleAnimations]);

  const handlePressIn = useCallback((id: string) => {
    setPressedItem(id);
    // Light haptic feedback on press start
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handlePressOut = useCallback(() => {
    setPressedItem(null);
  }, []);

  return (
    <View style={[styles.nav, { 
      backgroundColor: theme.card,
      borderTopColor: theme.border 
    }]}>
      {navItems.map((item) => (
        <Animated.View
          key={item.id}
          style={[
            { transform: [{ scale: scaleAnimations[item.id] }] }
          ]}
        >
          <TouchableOpacity
            onPress={() => handleNavPress(item.route, item.id)}
            onPressIn={() => handlePressIn(item.id)}
            onPressOut={handlePressOut}
            style={[
              styles.navItem,
              item.isActive && styles.activeNavItem,
              pressedItem === item.id && [styles.pressedNavItem, { backgroundColor: `${theme.primary}25` }]
            ]}
            activeOpacity={0.8}
            disabled={navigatingTo === item.id}
          >
            <View style={[
              styles.iconContainer,
              item.isActive && [styles.activeIconContainer, { backgroundColor: theme.primary }],
              pressedItem === item.id && [styles.pressedIconContainer, { backgroundColor: theme.primary }]
            ]}>
              {navigatingTo === item.id ? (
                <ActivityIndicator size={getBottomNavIconSize()} color={theme.primary} />
              ) : (
                <Ionicons
                  name={item.isActive ? item.activeIcon as any : item.icon as any}
                  size={getBottomNavIconSize()}
                  color={item.isActive ? theme.buttonText : theme.subtext}
                />
              )}
            </View>
            <Text style={[
              styles.navLabel,
              { 
                color: item.isActive ? theme.primary : theme.subtext,
                fontWeight: item.isActive ? '600' : '500'
              }
            ]}>
              {item.label}
            </Text>
            {pressedItem === item.id && !item.isActive && (
              <View style={[styles.pressIndicator, { backgroundColor: `${theme.primary}60` }]} />
            )}
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    height: getBottomNavHeight(),
    paddingVertical: isSmallDevice ? 6 : 12, // Reduced vertical padding for SE
    paddingBottom: Platform.OS === 'ios' 
      ? (isSmallDevice ? 16 : 24) // Reduced bottom padding for SE
      : (isSmallDevice ? 6 : 12), // Reduced for Android SE too
    borderTopWidth: 1,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: isSmallDevice ? 8 : 12, // Reduced back to 8 for SE
    paddingHorizontal: 4,
    borderRadius: 12,
    position: 'relative',
  },
  activeNavItem: {
    borderRadius: 12,
  },
  pressedNavItem: {
    borderRadius: 12,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  pressedIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  navLabel: {
    fontSize: isSmallDevice ? 10 : getBottomNavFontSize(), // Reduced back to 10 for SE
    textAlign: 'center',
    marginTop: isSmallDevice ? 2 : 3, // Reduced margin for SE
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  pressIndicator: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
});
