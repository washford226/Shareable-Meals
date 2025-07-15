import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const AICreateMeal = () => {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [generatedMeal, setGeneratedMeal] = useState<{
    name: string;
    description: string;
    servings: string;
    ingredients: { name: string; quantity: string; unit: string }[];
    instructions: string;
  }>({
    name: "",
    description: "",
    servings: "1",
    ingredients: [],
    instructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [usePantry, setUsePantry] = useState(false);
  const [fetchingRestrictions, setFetchingRestrictions] = useState(true);

  // Helper function to parse AI ingredients into array of objects
  function parseAIIngredients(ingredientText: string) {
    return ingredientText
      .split(/\r?\n|,/)
      .map(line => line.replace(/^\*\s*/, '').trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Try to match "quantity unit name"
        const match = line.match(/^([\d\/\.]+)?\s*([a-zA-Z]+)?\s*(.+)$/);
        if (match) {
          return {
            quantity: match[1] || "",
            unit: match[2] || "",
            name: match[3] || line,
          };
        }
        return { quantity: "", unit: "", name: line };
      });
  }

  // Fetch dietary restrictions and user ID from Supabase
  useEffect(() => {
    const fetchDietaryRestrictions = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          Alert.alert("Error", "User not authenticated. Please log in.");
          router.replace("/login");
          return;
        }
        setUserId(userData.user.id);

        // Fetch user profile from 'users' table
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userData.user.id)
          .single();

        if (error) {
          Alert.alert("Error", "Failed to fetch dietary restrictions.");
          return;
        }

        setDietaryRestrictions(data.dietary_restrictions || "");
        setAllergies(data.allergies || "");
      } catch (error) {
        console.error("Error fetching dietary restrictions:", error);
        Alert.alert("Error", "An error occurred while fetching dietary restrictions.");
      } finally {
        setFetchingRestrictions(false);
      }
    };

    fetchDietaryRestrictions();
  }, []);

  const handleSaveMeal = async () => {
    if (
      !generatedMeal.name ||
      !generatedMeal.description ||
      !generatedMeal.ingredients.length ||
      !generatedMeal.instructions
    ) {
      Alert.alert("Error", "Please ensure all fields are filled before saving.");
      return;
    }

    try {
      if (!userId) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      // Save meal to Supabase 'meals' table
      const { error } = await supabase.from("meals").insert([
        {
          name: generatedMeal.name,
          description: generatedMeal.description,
          ingredients: generatedMeal.ingredients,
          instructions: generatedMeal.instructions,
          user_id: userId,
          created_by_ai: true,
          dietary_restrictions: dietaryRestrictions,
          allergies: allergies,
        },
      ]);

      if (error) {
        throw new Error(error.message || "Failed to add meal to the database.");
      }

      Alert.alert("Success", "Meal added successfully!");
      router.push("/(app)/my-meals/meals");
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database.");
    }
  };

  // Ingredient input handlers
  const addIngredient = () => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", quantity: "", unit: "" }],
    }));
  };

  const removeIngredient = (index: number) => {
    setGeneratedMeal(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, field: "name" | "quantity" | "unit", value: string) => {
    setGeneratedMeal(prev => {
      const newIngredients = [...prev.ingredients];
      newIngredients[index][field] = value;
      return { ...prev, ingredients: newIngredients };
    });
  };

  // Replace this with your own AI meal generation logic or API call
  const handleGenerateMeal = async () => {
    if (!prompt.trim()) {
      Alert.alert("Error", "Please enter a prompt.");
      return;
    }

    setLoading(true);
    setGeneratedMeal({
      name: "",
      description: "",
      servings: "1",
      ingredients: [],
      instructions: "",
    });

    try {
      // Example: Replace with your own AI meal generation logic or API call
      // Here, we just mock a meal for demonstration
      // You can call your own backend or AI API here if needed
      setTimeout(() => {
        setGeneratedMeal({
          name: "AI Generated Meal",
          description: "A delicious meal generated by AI.",
          servings: "1",
          ingredients: [
            { name: "Ingredient 1", quantity: "1", unit: "cup" },
            { name: "Ingredient 2", quantity: "2", unit: "tbsp" },
          ],
          instructions: "1. Mix ingredients.\n2. Cook for 20 minutes.\n3. Serve hot.",
        });
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error("Error generating meal:", error);
      Alert.alert("Error", "An error occurred while generating the meal.");
      setLoading(false);
    }
  };

  if (fetchingRestrictions) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Fetching dietary restrictions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/(app)/my-meals/meals")}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>AI Meal Creator</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter a meal prompt (e.g., vegan dinner)"
        value={prompt}
        onChangeText={setPrompt}
      />

      <Text style={styles.dietaryText}>
        Dietary Restrictions: {dietaryRestrictions || "None"}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGenerateMeal}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Generate Meal</Text>
        )}
      </TouchableOpacity>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            { backgroundColor: usePantry ? "#007BFF" : "transparent" },
          ]}
          onPress={() => setUsePantry(!usePantry)}
        />
        <Text style={styles.checkboxLabel}>Use ingredients from my pantry</Text>
      </View>

      <ScrollView style={styles.resultContainer}>
        {generatedMeal.name ? (
          <>
            <TextInput
              style={[styles.resultInput, styles.multilineInput]}
              value={generatedMeal.name}
              onChangeText={(text) =>
                setGeneratedMeal((prev) => ({ ...prev, name: text }))
              }
              placeholder="Meal Name"
              multiline={true}
            />
            <TextInput
              style={[styles.resultInput, styles.multilineInput]}
              value={generatedMeal.description}
              onChangeText={(text) =>
                setGeneratedMeal((prev) => ({ ...prev, description: text }))
              }
              placeholder="Description"
              multiline={true}
            />
            <TextInput
              style={[styles.resultInput]}
              value={generatedMeal.servings}
              onChangeText={text =>
                setGeneratedMeal(prev => ({ ...prev, servings: text }))
              }
              placeholder="Servings"
              keyboardType="numeric"
            />
            {/* Ingredients Section */}
            <Text style={{ fontWeight: "bold", marginBottom: 8 }}>Ingredients</Text>
            {generatedMeal.ingredients.map((ingredient, idx) => (
              <View key={idx} style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
                <TextInput
                  style={[styles.resultInput, { flex: 2, marginRight: 5 }]}
                  placeholder="Name"
                  value={ingredient.name}
                  onChangeText={text => updateIngredient(idx, "name", text)}
                />
                <TextInput
                  style={[styles.resultInput, { flex: 1, marginRight: 5 }]}
                  placeholder="Qty"
                  value={ingredient.quantity}
                  onChangeText={text => updateIngredient(idx, "quantity", text)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.resultInput, { flex: 1, marginRight: 5 }]}
                  placeholder="Unit"
                  value={ingredient.unit}
                  onChangeText={text => updateIngredient(idx, "unit", text)}
                />
                <TouchableOpacity onPress={() => removeIngredient(idx)}>
                  <Text style={{ color: "#d00", fontWeight: "bold", fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={addIngredient} style={{ marginBottom: 15 }}>
              <Text style={{ color: "#007BFF", fontWeight: "bold" }}>+ Add Ingredient</Text>
            </TouchableOpacity>
            {/* End Ingredients Section */}
            <TextInput
              style={[styles.resultInput, styles.multilineInput]}
              value={generatedMeal.instructions}
              onChangeText={(text) =>
                setGeneratedMeal((prev) => ({ ...prev, instructions: text }))
              }
              placeholder="Instructions"
              multiline={true}
            />
            {/* Add Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveMeal}
            >
              <Text style={styles.saveButtonText}>Save Meal</Text>
            </TouchableOpacity>
          </>
        ) : (
          !loading && (
            <Text style={styles.placeholderText}>
              Your meal will appear here...
            </Text>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  backButton: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#ccc",
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    color: "#000",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  dietaryText: {
    fontSize: 16,
    marginBottom: 16,
    color: "#555",
  },
  button: {
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultContainer: {
    flex: 1,
    marginTop: 16,
  },
  resultInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
  },
  placeholderText: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    marginTop: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#007BFF",
    marginRight: 8,
    borderRadius: 4,
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#555",
  },
});

export default AICreateMeal;
