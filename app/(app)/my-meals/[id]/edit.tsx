import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

export default function EditMealScreen() {
  const { id: mealId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<string>("");
  const [calories, setCalories] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [carbohydrates, setCarbohydrates] = useState<string>("");
  const [fat, setFat] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [recipeLink, setRecipeLink] = useState<string>("");
  const [visibility, setVisibility] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchMealDetails = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        router.back();
        return;
      }

      const response = await axios.get(`${BASE_URL}/meals/${mealId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const meal = response.data;
        setName(meal.name);
        setDescription(meal.description);
        setIngredients(meal.ingredients);
        setCalories(meal.calories?.toString() || "");
        setProtein(meal.protein?.toString() || "");
        setCarbohydrates(meal.carbohydrates?.toString() || "");
        setFat(meal.fat?.toString() || "");
        setInstructions(meal.instructions || "");
        setRecipeLink(meal.recipeLink || "");
        setVisibility(meal.visibility);
      } else {
        Alert.alert("Error", "Failed to fetch meal details.");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching meal details:", error);
      Alert.alert("Error", "An error occurred while fetching meal details.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !ingredients.trim()) {
      Alert.alert("Validation Error", "Name, description, and ingredients are required.");
      return;
    }

    setSaving(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.put(
        `${BASE_URL}/meals/${mealId}`,
        {
          name: name.trim(),
          description: description.trim(),
          ingredients: ingredients.trim(),
          calories: calories ? parseInt(calories) : null,
          protein: protein ? parseInt(protein) : null,
          carbohydrates: carbohydrates ? parseInt(carbohydrates) : null,
          fat: fat ? parseInt(fat) : null,
          instructions: instructions.trim(),
          recipeLink: recipeLink.trim(),
          visibility,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        Alert.alert("Success", "Meal updated successfully!");
        router.back();
      } else {
        Alert.alert("Error", "Failed to update meal. Please try again.");
      }
    } catch (error) {
      console.error("Error updating meal:", error);
      Alert.alert("Error", "An error occurred while updating the meal.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!mealId) {
      Alert.alert("Error", "Meal ID is missing. Returning to the previous screen.");
      router.back();
      return;
    }

    fetchMealDetails();
  }, [mealId]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading meal details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.label, { color: theme.text }]}>Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={name}
        onChangeText={setName}
        placeholder="Meal Name"
        placeholderTextColor={theme.placeholder}
      />

      <Text style={[styles.label, { color: theme.text }]}>Description</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Meal Description"
        placeholderTextColor={theme.placeholder}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Ingredients</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={ingredients}
        onChangeText={setIngredients}
        placeholder="Ingredients (comma-separated)"
        placeholderTextColor={theme.placeholder}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Calories</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={calories}
        onChangeText={setCalories}
        placeholder="Calories"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Protein (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={protein}
        onChangeText={setProtein}
        placeholder="Protein"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Carbohydrates (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={carbohydrates}
        onChangeText={setCarbohydrates}
        placeholder="Carbohydrates"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Fat (g)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={fat}
        onChangeText={setFat}
        placeholder="Fat"
        placeholderTextColor={theme.placeholder}
        keyboardType="numeric"
      />

      <Text style={[styles.label, { color: theme.text }]}>Instructions</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={instructions}
        onChangeText={setInstructions}
        placeholder="Instructions"
        placeholderTextColor={theme.placeholder}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Recipe Link</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
        value={recipeLink}
        onChangeText={setRecipeLink}
        placeholder="Recipe Link (optional)"
        placeholderTextColor={theme.placeholder}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>Visibility</Text>
        <Switch
          value={visibility}
          onValueChange={setVisibility}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={visibility ? theme.primary : theme.border}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: theme.button }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={theme.buttonText} />
        ) : (
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: theme.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  label: {
    marginTop: 16,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  saveButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
  },
});