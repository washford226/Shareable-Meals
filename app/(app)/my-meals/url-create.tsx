import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// Dynamically set the BASE_URL based on the platform
const BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

// Robust ingredient parser
function normalizeFractions(input: string): string {
  // Convert "/2" to "1/2", etc.
  return input.replace(/(^|\s)(\/\d+)/g, (_, prefix, fraction) => `${prefix}1${fraction}`);
}

function parseIngredientLine(line: string) {
  if (!line || typeof line !== 'string') return null;

  let cleaned = line.trim();

  // Skip lines like "81 14143 1 onion med"
  if (/^\d+\s+\d+\s+\d+/.test(cleaned)) return null;

  // Normalize fractions
  cleaned = normalizeFractions(cleaned);

  // Remove leading asterisks, dashes, or bullet characters
  cleaned = cleaned.replace(/^[\*\-\d\.\s\/]+/, '').trim();

  // Fix common ordering like "tsp olive 1 oil" → "1 tsp olive oil"
  const misorderedMatch = cleaned.match(/^([a-zA-Z]+)\s+(.+?)\s+([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)$/);
  if (misorderedMatch) {
    const [, unit, name, quantity] = misorderedMatch;
    return {
      quantity: quantity,
      unit: unit,
      name: name,
      raw_name: name,
    };
  }

  // Match normal pattern: quantity + unit + name
  const match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s+([a-zA-Z]+)\s+(.+)$/);
  if (match) {
    const [, quantity, unit, name] = match;
    return {
      quantity: quantity,
      unit: unit,
      name: name,
      raw_name: name,
    };
  }

  // Match simple name-only fallback (e.g., "garlic")
  const fallbackMatch = cleaned.match(/^(.+)$/);
  if (fallbackMatch) {
    const name = fallbackMatch[1].trim();
    if (name.split(" ").length < 2 || ['tsp', 'tbsp', 'cup', 'large', 'med', 'small'].includes(name.toLowerCase())) {
      return null; // likely a malformed line
    }
    return {
      quantity: "1",
      unit: "",
      name: name,
      raw_name: name,
    };
  }

  return null;
}


const URLCreateMealScreen: React.FC = () => {
  const router = useRouter();
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
        // Accept both array and string for ingredients
        if (Array.isArray(ingredients)) {
          setIngredients(ingredients.join(", "));
        } else {
          setIngredients(ingredients || "");
        }
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
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      // Parse ingredients into objects for backend macro calculation
      const ingredientObjects = ingredients
        .split(/\r?\n|,/)
        .map((ingredient) => parseIngredientLine(ingredient.trim()))
        .filter((ing) => ing && ing.name && ing.name.length > 0);

      const formData = new FormData();
      formData.append("name", mealName);
      formData.append("description", description);
      formData.append("ingredients", JSON.stringify(ingredientObjects));
      formData.append("instructions", instructions);
      formData.append("recipeLink", recipeUrl);
      formData.append("created_by", recipeUrl);

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
          onPress: () => router.push("./meals"),
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
      <Text style={styles.label}>Ingredients (comma or newline separated)</Text>
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