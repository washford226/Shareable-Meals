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
  const [mealIngredients, setMealIngredients] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbohydrates, setMealCarbohydrates] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [mealInstructions, setMealInstructions] = useState("");
  const [mealRecipeLink, setMealRecipeLink] = useState("");
  const [mealPicture, setMealPicture] = useState<string | null>(null);
  const [mealVisibility, setMealVisibility] = useState(true);

  const pickMealImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const handleAddMeal = async () => {
    if (!mealName || !mealDescription || !mealIngredients) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    const formData = new FormData();
    formData.append("name", mealName);
    formData.append("description", mealDescription);
    formData.append(
      "ingredients",
      JSON.stringify(mealIngredients.split(",").map((ingredient) => ingredient.trim()))
    );
    formData.append("calories", mealCalories);
    formData.append("protein", mealProtein);
    formData.append("carbohydrates", mealCarbohydrates);
    formData.append("fat", mealFat);
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

      const response = await fetch(`${BASE_URL}/meals`, {
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

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Ingredients (comma-separated)"
        placeholderTextColor={theme.placeholder}
        value={mealIngredients}
        onChangeText={setMealIngredients}
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Calories"
        placeholderTextColor={theme.placeholder}
        value={mealCalories}
        onChangeText={setMealCalories}
        keyboardType="numeric"
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Protein (g)"
        placeholderTextColor={theme.placeholder}
        value={mealProtein}
        onChangeText={setMealProtein}
        keyboardType="numeric"
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Carbs (g)"
        placeholderTextColor={theme.placeholder}
        value={mealCarbohydrates}
        onChangeText={setMealCarbohydrates}
        keyboardType="numeric"
        multiline
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
        placeholder="Fat (g)"
        placeholderTextColor={theme.placeholder}
        value={mealFat}
        onChangeText={setMealFat}
        keyboardType="numeric"
        multiline
      />

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
