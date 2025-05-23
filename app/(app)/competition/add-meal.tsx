import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const AddMeal = () => {
  interface Meal {
    id: number; // Updated to match the backend response
    name: string;
    favorite: boolean;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch user's meals
  const fetchUserMeals = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/meal/my-meals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMeals(response.data);
    } catch (error) {
      console.error("Error fetching user meals:", error);
      Alert.alert("Error", "Failed to fetch your meals. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a meal to the competition
 const [addingMeal, setAddingMeal] = useState(false);

const handleAddMeal = async (mealId: number) => {
  setAddingMeal(true);
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    await axios.post(
      `${BASE_URL}/comp/competitions/current/meals`,
      { meal_id: mealId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    Alert.alert("Success", "Meal added to the competition!");
    router.push("/competition/current-meals");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error adding meal to competition:", error.response?.data || error.message);
    } else {
      console.error("Error adding meal to competition:", error);
    }
    Alert.alert("Error", "Failed to add your meal to the competition. Please try again later.");
  } finally {
    setAddingMeal(false);
  }
};

  useEffect(() => {
    fetchUserMeals();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.primary }]}
        onPress={() => router.back()} // Navigate back to the previous screen
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text }]}>Your Meals</Text>

      <FlatList
        data={meals}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()} // Updated to use `id`
        renderItem={({ item }) => {
          if (!item.id) {
            console.warn("Invalid meal object:", item); // Debugging log
            return null;
          }
          return (
            <View style={[styles.mealContainer, { backgroundColor: theme.card }]}>
              <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => handleAddMeal(item.id)} // Updated to use `id`
              >
                <Text style={[styles.addButtonText, { color: theme.buttonText }]}>Add to Competition</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            You have no meals to add to the competition.
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  mealContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});

export default AddMeal;