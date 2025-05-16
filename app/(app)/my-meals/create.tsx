import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const CreateMealScreen = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { selectedDay } = useLocalSearchParams<{ selectedDay?: string }>();

  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [ingredients, setIngredients] = useState([{ name: "", quantity: "", unit: "" }]);
  const [mealInstructions, setMealInstructions] = useState("");
  const [mealRecipeLink, setMealRecipeLink] = useState("");
  const [mealPicture, setMealPicture] = useState<string | null>(null);
  const [mealVisibility, setMealVisibility] = useState(true);

  const pickMealImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const uriParts = result.assets[0].uri.split(".");
        const fileType = uriParts[uriParts.length - 1].toLowerCase();

        if (!["jpg", "jpeg", "png"].includes(fileType)) {
          Alert.alert("Error", "Only JPEG and PNG images are allowed.");
          return;
        }

        setMealPicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick an image.");
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: "name" | "quantity" | "unit", value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  const handleAddMeal = async () => {
    if (
      !mealName ||
      !mealDescription ||
      ingredients.some(i => !i.name || !i.quantity || !i.unit)
    ) {
      Alert.alert("Error", "Please fill in all required fields and ingredients.");
      return;
    }

    const formData = new FormData();
    formData.append("name", mealName);
    formData.append("description", mealDescription);
    formData.append("ingredients", JSON.stringify(ingredients));
    formData.append("instructions", mealInstructions);
    formData.append("recipeLink", mealRecipeLink);
    formData.append("visibility", mealVisibility ? "1" : "0");
    formData.append("day", selectedDay || "");

    if (mealPicture) {
      const uriParts = mealPicture.split(".");
      const fileType = uriParts[uriParts.length - 1];
      formData.append("picture", {
        uri: mealPicture,
        name: `meal_picture.${fileType}`,
        type: `image/${fileType}`,
      } as any);
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in again.");
        return;
      }

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

      Alert.alert("Success", "Meal added successfully!");
      router.back();
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database.");
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Create a New Meal</Text>

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Meal Name"
        placeholderTextColor={theme.placeholder}
        value={mealName}
        onChangeText={setMealName}
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Meal Description"
        placeholderTextColor={theme.placeholder}
        value={mealDescription}
        onChangeText={setMealDescription}
        multiline
      />

      <Text style={[styles.label, { color: theme.text }]}>Ingredients</Text>
      {ingredients.map((ingredient, idx) => (
        <View key={idx} style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 5, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Name"
            placeholderTextColor={theme.placeholder}
            value={ingredient.name}
            onChangeText={text => updateIngredient(idx, "name", text)}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Qty"
            placeholderTextColor={theme.placeholder}
            value={ingredient.quantity}
            onChangeText={text => updateIngredient(idx, "quantity", text)}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 5, backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            placeholder="Unit"
            placeholderTextColor={theme.placeholder}
            value={ingredient.unit}
            onChangeText={text => updateIngredient(idx, "unit", text)}
          />
          <TouchableOpacity onPress={() => removeIngredient(idx)}>
            <Text style={{ color: theme.danger, fontWeight: "bold", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={addIngredient} style={{ marginBottom: 15 }}>
        <Text style={{ color: theme.primary, fontWeight: "bold" }}>+ Add Ingredient</Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Instructions"
        placeholderTextColor={theme.placeholder}
        value={mealInstructions}
        onChangeText={setMealInstructions}
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Recipe Link"
        placeholderTextColor={theme.placeholder}
        value={mealRecipeLink}
        onChangeText={setMealRecipeLink}
        multiline
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: theme.text }]}>Make Meal Public</Text>
        <Switch
          value={mealVisibility}
          onValueChange={setMealVisibility}
          thumbColor={mealVisibility ? theme.primary : theme.border}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>

      <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.primary }]} onPress={pickMealImage}>
        <Text style={[styles.imagePickerText, { color: theme.buttonText }]}>Pick a Meal Image</Text>
      </TouchableOpacity>
      {mealPicture && <Image source={{ uri: mealPicture }} style={styles.mealPicture} />}

      <View style={styles.buttonContainer}>
        <View style={styles.button}>
          <Button title="Create Meal" onPress={handleAddMeal} color={theme.primary} />
        </View>
        <View style={styles.button}>
          <Button title="Cancel" onPress={() => router.back()} color={theme.danger} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    width: "100%",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 16,
  },
  imagePicker: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  imagePickerText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mealPicture: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default CreateMealScreen;