import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";

const NutritionNav: React.FC = () => {
  const router = useRouter();
  const { date } = useLocalSearchParams();
  const pathname = usePathname();
  const { theme } = useTheme();
  const normalizedDate = Array.isArray(date) ? date[0] : date;

  // Determine which tab is active
  const isDay = pathname?.includes("daynutrition");
  const isWeek = pathname?.includes("weeknutrition");
  const isMonth = pathname?.includes("monthnutrition");

  const navigationItems = [
    {
      id: 'day',
      label: 'Day',
      icon: 'today',
      route: '/(app)/meal-plan/[date]/daynutrition',
      isActive: isDay,
    },
    {
      id: 'week',
      label: 'Week',
      icon: 'calendar',
      route: '/(app)/meal-plan/[date]/weeknutrition',
      isActive: isWeek,
    },
    {
      id: 'month',
      label: 'Month',
      icon: 'calendar-outline',
      route: '/(app)/meal-plan/[date]/monthnutrition',
      isActive: isMonth,
    },
  ];

  const handleNavPress = (route: string) => {
    router.push({
      pathname: route as any,
      params: { date: normalizedDate },
    });
  };

  return (
    <View style={[styles.navContainer, { 
      backgroundColor: theme.card,
      borderColor: theme.border 
    }]}>
      <View style={[styles.segmentedControl, { backgroundColor: `${theme.border}40` }]}>
        {navigationItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.tab,
              item.isActive && [styles.activeTab, { 
                backgroundColor: theme.primary,
                shadowColor: theme.primary 
              }]
            ]}
            onPress={() => handleNavPress(item.route)}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Ionicons
                name={item.icon as any}
                size={16}
                color={item.isActive ? theme.buttonText : theme.subtext}
                style={styles.tabIcon}
              />
              <Text style={[
                styles.tabText,
                { color: item.isActive ? theme.buttonText : theme.subtext },
                item.isActive && styles.activeTabText
              ]}>
                {item.label}
              </Text>
            </View>
            {item.isActive && (
              <View style={[styles.activeIndicator, { backgroundColor: theme.buttonText }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    marginVertical: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    position: 'relative',
    minHeight: 44,
  },
  activeTab: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabIcon: {
    marginRight: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: 'center',
  },
  activeTabText: {
    fontWeight: "700",
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
});

export default NutritionNav;