import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router"; // Import useRouter

// Dynamically set the BASE_URL based on the platform
const BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const URLCreateMealScreen: React.FC = () => {
  const router = useRouter(); // Initialize the router
  const [recipeUrl, setRecipeUrl] = useState<string>("");
  const [mealName, setMealName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const handleFetchRecipe = async () => {
    if (!recipeUrl || !recipeUrl.startsWith("http")) {
      Alert.alert("Error", "Please enter a valid URL starting with http or https.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${BASE_URL}/urlmeals/fetch-recipe`, { url: recipeUrl });

      if (response.status === 200) {
        const { name, description, ingredients, instructions } = response.data;
        setMealName(name || "");
        setDescription(description || "");
        setIngredients(ingredients.join(", ") || "");
        setInstructions(instructions || "");
        Alert.alert("Success", "Recipe data fetched successfully!");
      } else {
        Alert.alert("Error", "Failed to fetch recipe data.");
      }
    } catch (error) {
      console.error("Error fetching recipe data:", error);
      Alert.alert("Error", "An error occurred while fetching recipe data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!mealName || !description || !ingredients || !instructions || !recipeUrl) {
      Alert.alert("Error", "Please ensure all fields are filled before saving.");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token"); // Retrieve the token
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const formData = new FormData();
      formData.append("name", mealName);
      formData.append("description", description);
      formData.append(
        "ingredients",
        JSON.stringify(ingredients.split(",").map((ingredient) => ingredient.trim()))
      );
      formData.append("instructions", instructions);
      formData.append("recipeLink", recipeUrl); // Add the recipe URL as recipeLink
      formData.append("created_by", recipeUrl); // Use the entered URL as the created_by value

      const response = await fetch(`${BASE_URL}/meal/meals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to add meal to the database.");
      }

      Alert.alert("Success", "Meal added successfully!", [
        {
          text: "OK",
          onPress: () => router.push("./meals"), // Navigate back to the previous screen
        },
      ]);
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.push("./meals")}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create Meal from URL</Text>

      {/* URL Input */}
      <Text style={styles.label}>Recipe URL</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter recipe URL"
        value={recipeUrl}
        onChangeText={setRecipeUrl}
      />
      <TouchableOpacity style={styles.button} onPress={handleFetchRecipe} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Fetching..." : "Fetch Recipe"}</Text>
      </TouchableOpacity>

      {/* Meal Name */}
      <Text style={styles.label}>Meal Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Meal Name"
        value={mealName}
        onChangeText={setMealName}
      />

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Ingredients */}
      <Text style={styles.label}>Ingredients (comma-separated)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ingredients"
        value={ingredients}
        onChangeText={setIngredients}
        multiline
      />

      {/* Instructions */}
      <Text style={styles.label}>Instructions</Text>
      <TextInput
        style={styles.input}
        placeholder="Instructions"
        value={instructions}
        onChangeText={setInstructions}
        multiline
      />

      {/* Save Meal Button */}
      <TouchableOpacity style={styles.button} onPress={handleSaveMeal} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Meal"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  backButton: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#ccc",
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: "#000",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default URLCreateMealScreen;