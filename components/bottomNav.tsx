import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import FontAwesome from "react-native-vector-icons/FontAwesome"; // Import FontAwesome icons

export default function BottomNav() {
  return (
    <View style={styles.nav}>
      <TouchableOpacity onPress={() => router.push("/(app)/meal-plan/calendar")} style={styles.navItem}>
        <FontAwesome name="calendar" size={20} color="#333" />
        <Text style={styles.link}>Calendar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/my-meals/meals")} style={styles.navItem}>
        <FontAwesome name="cutlery" size={20} color="#333" />
        <Text style={styles.link}>My Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/other-meals/other-meals")} style={styles.navItem}>
        <FontAwesome name="search" size={20} color="#333" />
        <Text style={styles.link}>Discover Meals</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(app)/account/account")} style={styles.navItem}>
        <FontAwesome name="user" size={20} color="#333" />
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
  navItem: {
    alignItems: "center", // Center the icon and text
  },
  link: {
    fontSize: 12, // Adjust font size to fit with the icon
    fontWeight: "600",
    color: "#333",
    marginTop: 4, // Add spacing between the icon and text
  },
});