import React, { memo, useCallback, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";

const BottomNav = memo(() => {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

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

  const handleNavPress = useCallback((route: string, id: string) => {
    // Prevent double navigation
    if (navigatingTo === id) return;
    
    setNavigatingTo(id);
    
    // Navigate immediately without waiting
    router.push(route as any);
    
    // Clear loading state quickly for visual feedback
    setTimeout(() => setNavigatingTo(null), 200);
  }, [navigatingTo]);

  return (
    <View style={[styles.nav, { 
      backgroundColor: theme.card,
      borderTopColor: theme.border 
    }]}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => handleNavPress(item.route, item.id)}
          style={[
            styles.navItem,
            item.isActive && [styles.activeNavItem, { backgroundColor: `${theme.primary}15` }]
          ]}
          activeOpacity={0.7}
          disabled={navigatingTo === item.id}
        >
          <View style={[
            styles.iconContainer,
            item.isActive && [styles.activeIconContainer, { backgroundColor: theme.primary }]
          ]}>
            {navigatingTo === item.id ? (
              <ActivityIndicator size={20} color={theme.primary} />
            ) : (
              <Ionicons
                name={item.isActive ? item.activeIcon as any : item.icon as any}
                size={item.isActive ? 20 : 18}
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
          {item.isActive && (
            <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
          )}
        </TouchableOpacity>
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
    paddingVertical: Platform.OS === 'ios' ? 20 : 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12, // Safe area for iOS
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    position: 'relative',
  },
  activeNavItem: {
    borderRadius: 12,
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
  navLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
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
});