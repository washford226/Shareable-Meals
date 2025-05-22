import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";

const NutritionNav: React.FC = () => {
  const router = useRouter();
  const { date } = useLocalSearchParams();
  const pathname = usePathname();
  const normalizedDate = Array.isArray(date) ? date[0] : date;

  // Determine which tab is active
  const isDay = pathname?.includes("daynutrition");
  const isWeek = pathname?.includes("weeknutrition");
  const isMonth = pathname?.includes("monthnutrition");

  return (
    <View style={styles.navContainer}>
      <TouchableOpacity
        style={[styles.tab, isDay && styles.activeTab]}
        onPress={() =>
          router.push({
            pathname: "/(app)/meal-plan/[date]/daynutrition",
            params: { date: normalizedDate },
          })
        }
      >
        <Text style={[styles.tabText, isDay && styles.activeTabText]}>Day</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, isWeek && styles.activeTab]}
        onPress={() =>
          router.push({
            pathname: "/(app)/meal-plan/[date]/weeknutrition",
            params: { date: normalizedDate },
          })
        }
      >
        <Text style={[styles.tabText, isWeek && styles.activeTabText]}>Week</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, isMonth && styles.activeTab]}
        onPress={() =>
          router.push({
            pathname: "/(app)/meal-plan/[date]/monthnutrition",
            params: { date: normalizedDate },
          })
        }
      >
        <Text style={[styles.tabText, isMonth && styles.activeTabText]}>Month</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
    backgroundColor: "#e6eaf0",
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 2,
    backgroundColor: "transparent",
  },
  activeTab: {
    backgroundColor: "#4F8EF7",
  },
  tabText: {
    color: "#4F8EF7",
    fontWeight: "bold",
    fontSize: 16,
  },
  activeTabText: {
    color: "#fff",
  },
});

export default NutritionNav;