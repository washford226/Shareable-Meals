import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// Dynamically set the BASE_URL based on the platform
const BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

// Ingredient input row component
const IngredientRow = ({ ingredient, onChange, onRemove }: any) => (
  <View style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
    <TextInput
      style={[styles.input, { flex: 2, marginRight: 5 }]}
      placeholder="Name"
      value={ingredient.name}
      onChangeText={text => onChange("name", text)}
    />
    <TextInput
      style={[styles.input, { flex: 1, marginRight: 5 }]}
      placeholder="Qty"
      value={ingredient.quantity}
      onChangeText={text => onChange("quantity", text)}
      keyboardType="numeric"
    />
    <TextInput
      style={[styles.input, { flex: 1, marginRight: 5 }]}
      placeholder="Unit"
      value={ingredient.unit}
      onChangeText={text => onChange("unit", text)}
    />
    <TouchableOpacity onPress={onRemove}>
      <Text style={{ color: "#d00", fontWeight: "bold", fontSize: 18 }}>✕</Text>
    </TouchableOpacity>
  </View>
);

const URLCreateMealScreen: React.FC = () => {
  const router = useRouter();
  const [recipeUrl, setRecipeUrl] = useState<string>("");
  const [mealName, setMealName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([]);
  const [instructions, setInstructions] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [servings, setServings] = useState<string>("1");

  // Add, remove, update ingredient handlers
  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: "", quantity: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: "name" | "quantity" | "unit", value: string) => {
    setIngredients(prev => {
      const newIngredients = [...prev];
      newIngredients[index][field] = value;
      return newIngredients;
    });
  };

  // Parse a string or array of ingredients into [{name, quantity, unit}]
function parseIngredientLine(line: string) {
  if (!line || typeof line !== 'string') return null;
  let cleaned = line.trim();
  cleaned = cleaned.replace(/^[\*\-\d\.\s\/]+/, '').trim();

  // Common units for matching
  const units = [
    "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
    "oz", "ounce", "ounces", "lb", "pound", "pounds", "g", "gram", "grams", "kg", "ml", "l", "clove", "cloves", "slice", "slices", "can", "cans", "package", "packages", "stick", "sticks", "inch", "inches"
  ];
  const unitsPattern = units.join("|");

  // 1. quantity unit name (e.g., "1 cup ketchup")
  let match = cleaned.match(
    new RegExp(`^([\\d¼½¾⅓⅔⅛⅜⅝⅞\\/\\.]+)\\s+(${unitsPattern})\\s+(.+)$`, "i")
  );
  if (match) {
    const [, quantity, unit, name] = match;
    return { quantity, unit, name };
  }

  // 2. quantity name (e.g., "2 eggs")
  match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s+(.+)$/);
  if (match) {
    const [, quantity, name] = match;
    return { quantity, unit: "", name };
  }

  // 3. name quantity unit (e.g., "soy sauce 1/4 cup")
  match = cleaned.match(/^(.+?)\s+([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s*([a-zA-Z]+)?$/);
  if (match) {
    return {
      name: match[1].trim(),
      quantity: match[2].trim(),
      unit: match[3]?.trim() || "",
    };
  }

  // 4. unit name (e.g., "cup ketchup")
  match = cleaned.match(
    new RegExp(`^(${unitsPattern})\\s+(.+)$`, "i")
  );
  if (match) {
    const [, unit, name] = match;
    return { quantity: "1", unit, name };
  }

  // fallback
  return { name: cleaned, quantity: "", unit: "" };
}

  const handleFetchRecipe = async () => {
    if (!recipeUrl || !recipeUrl.startsWith("http")) {
      Alert.alert("Error", "Please enter a valid URL starting with http or https.");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${BASE_URL}/urlmeals/fetch-recipe`, { url: recipeUrl });

      if (response.status === 200) {
        const { name, description, ingredients: ing, instructions } = response.data;
        setMealName(name || "");
        setDescription(description || "");
        setServings(response.data.servings ? String(response.data.servings) : "1");
        // Accept both array and string for ingredients
       let parsedIngredients: { name: string; quantity: string; unit: string }[] = [];
        if (Array.isArray(ing)) {
          parsedIngredients = ing
            .map((item: any) =>
              typeof item === "string" ? parseIngredientLine(item) : item
            )
            .filter((i: any): i is { name: string; quantity: string; unit: string } => !!i && !!i.name);
        } else if (typeof ing === "string") {
          parsedIngredients = ing
            .split(/\r?\n|,/)
            .map((line: string) => parseIngredientLine(line))
            .filter((i: any): i is { name: string; quantity: string; unit: string } => !!i && !!i.name);
        }
        setIngredients(parsedIngredients);
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
    if (!mealName || !description || !ingredients.length || !instructions || !recipeUrl) {
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

      const formData = new FormData();
      formData.append("name", mealName);
      formData.append("description", description);
      formData.append("servings", servings);
      formData.append("ingredients", JSON.stringify(ingredients));
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

      <Text style={styles.label}>Servings</Text>
        <TextInput
          style={styles.input}
          placeholder="Servings"
          value={servings}
          onChangeText={setServings}
          keyboardType="numeric"
        />

      {/* Ingredients */}
      <Text style={styles.label}>Ingredients</Text>
      {ingredients.map((ingredient, idx) => (
        <IngredientRow
          key={idx}
          ingredient={ingredient}
          onChange={(field: "name" | "quantity" | "unit", value: string) =>
            updateIngredient(idx, field, value)
          }
          onRemove={() => removeIngredient(idx)}
        />
      ))}
      <TouchableOpacity onPress={addIngredient} style={{ marginBottom: 15 }}>
        <Text style={{ color: "#007BFF", fontWeight: "bold" }}>+ Add Ingredient</Text>
      </TouchableOpacity>

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
    backgroundColor: "#f9f9f9",
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