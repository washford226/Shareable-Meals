import React, { useState, useEffect, use } from "react";
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
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router"; // Import useRouter for navigation

const BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const AICreateMeal = () => {
  const router = useRouter(); // Initialize the router for navigation
  const [prompt, setPrompt] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState(""); // New state for allergies
  const [userId, setUserId] = useState<string | null>(null); // Add state for user ID
  const [generatedMeal, setGeneratedMeal] = useState<{
    name: string;
    description: string;
    ingredients: string;
    instructions: string;
  }>({
    name: "",
    description: "",
    ingredients: "",
    instructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [usePantry, setUsePantry] = useState(false); // State for pantry checkbox
  const [fetchingRestrictions, setFetchingRestrictions] = useState(true);

  // Fetch dietary restrictions and user ID from the backend
  useEffect(() => {
    const fetchDietaryRestrictions = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          Alert.alert("Error", "User not authenticated. Please log in.");
          return;
        }

        const response = await axios.get(`${BASE_URL}/users/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 200) {
          setDietaryRestrictions(response.data.dietary_restrictions || "");
          setUserId(response.data.id || null); // Store the user ID
          setAllergies(response.data.allergies || ""); // Store the allergies
        } else {
          Alert.alert("Error", "Failed to fetch dietary restrictions.");
        }
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
  if (!generatedMeal.name || !generatedMeal.description || !generatedMeal.ingredients || !generatedMeal.instructions) {
    Alert.alert("Error", "Please ensure all fields are filled before saving.");
    return;
  }

  try {
    const token = await AsyncStorage.getItem("token"); // Retrieve the token
    if (!token) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    const formData = new FormData();
    formData.append("name", generatedMeal.name);
    formData.append("description", generatedMeal.description);
    formData.append(
      "ingredients",
      JSON.stringify(generatedMeal.ingredients.split(",").map((ingredient) => ingredient.trim()))
    );
    formData.append("instructions", generatedMeal.instructions);
    
    const response = await fetch(`${BASE_URL}/meal/meal-ai`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to add meal to the database.");
      }

      Alert.alert("Success", "Meal added successfully!");
      router.push("/(app)/my-meals/meals"); // Navigate to the meals screen
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database.");
    }
  };

  const handleGenerateMeal = async () => {
    if (!prompt.trim()) {
      Alert.alert("Error", "Please enter a prompt.");
      return;
    }

    setLoading(true);
    setGeneratedMeal({
      name: "",
      description: "",
      ingredients: "",
      instructions: "",
    });

    try {
      const token = await AsyncStorage.getItem("token"); // Retrieve the token
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.post(
        `${BASE_URL}/AI/generate-meal`,
        {
          prompt,
          dietaryRestrictions: dietaryRestrictions.trim(),
          usePantry,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
          },
        }
      );

      if (response.status === 200) {
        setGeneratedMeal(response.data); // Set the structured meal response
      } else {
        Alert.alert("Error", "Failed to generate a meal. Please try again.");
      }
    } catch (error) {
      console.error("Error generating meal:", error);
      Alert.alert("Error", "An error occurred while generating the meal.");
    } finally {
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
    onPress={() => setUsePantry(!usePantry)} // Toggle the checkbox state
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
              style={[styles.resultInput, styles.multilineInput]}
              value={generatedMeal.ingredients}
              onChangeText={(text) =>
                setGeneratedMeal((prev) => ({ ...prev, ingredients: text }))
              }
              placeholder="Ingredients"
              multiline={true}
            />
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
    height: 100, // Increase height for multiline inputs
    textAlignVertical: "top", // Align text to the top
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
  borderRadius: 4, // Optional: Add rounded corners
},
checkboxLabel: {
  fontSize: 16,
  color: "#555",
},
});

export default AICreateMeal;