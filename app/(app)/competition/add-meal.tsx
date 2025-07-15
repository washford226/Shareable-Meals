import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const AddMeal = () => {
  interface Meal {
    id: number;
    name: string;
    favorite: boolean;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMeal, setAddingMeal] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch user's meals from Supabase
  const fetchUserMeals = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setLoading(false);
        return;
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("meals")
        .select("id, name, favorite")
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
      setMeals(data || []);
    } catch (error) {
      console.error("Error fetching user meals:", error);
      Alert.alert("Error", "Failed to fetch your meals. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a meal to the competition
  const handleAddMeal = async (mealId: number) => {
    setAddingMeal(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setAddingMeal(false);
        return;
      }
      const userId = userData.user.id;

      // Insert into 'competition_meals' (or your competition meals table)
      const { error } = await supabase
        .from("competition_meals")
        .insert([{ meal_id: mealId, user_id: userId }]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal added to the competition!");
      router.push("/competition/current-meals");
    } catch (error) {
      console.error("Error adding meal to competition:", error);
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
        onPress={() => router.back()}
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text }]}>Your Meals</Text>

      <FlatList
        data={meals}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={({ item }) => {
          if (!item.id) {
            console.warn("Invalid meal object:", item);
            return null;
          }
          return (
            <View style={[styles.mealContainer, { backgroundColor: theme.card }]}>
              <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => handleAddMeal(item.id)}
                disabled={addingMeal}
              >
                <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
                  {addingMeal ? "Adding..." : "Add to Competition"}
                </Text>
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
