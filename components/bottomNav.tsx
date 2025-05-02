import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function BottomNav() {
  return (
    <View style={styles.nav}>
      <TouchableOpacity onPress={() => router.push("/(app)/meal-plan/calendar")}>
        <Text style={styles.link}>Calendar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/my-meals/meals")}>
        <Text style={styles.link}>My Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/other-meals/other-meals")}>
        <Text style={styles.link}>Discover Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/account/account")}>
        <Text style={styles.link}>Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8f8f8",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#ddd",
    zIndex: 999,
  },
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
});
