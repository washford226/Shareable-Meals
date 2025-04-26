import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const CreateMealScreen = ({ route, navigation }: any) => {
  const { selectedDay } = route.params || {};
  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [mealIngredients, setMealIngredients] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbohydrates, setMealCarbohydrates] = useState("");
  const [mealFat, setMealFat] = useState("");
<<<<<<< Updated upstream
=======
  const [mealPicture, setMealPicture] = useState<string | null>(null);
  const [mealInstructions, setMealInstructions] = useState("");
  const [recipeLink, setRecipeLink] = useState("");

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need access to your gallery to pick an image.");
    }
  };

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
>>>>>>> Stashed changes

  const handleAddMeal = async () => {
    console.log(mealName, mealDescription, mealIngredients, mealCalories, mealProtein, mealCarbohydrates, mealFat);
    if (!mealName || !mealDescription || !mealIngredients) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
<<<<<<< Updated upstream
    const newMeal = {
      name: mealName,
      description: mealDescription,
      ingredients: mealIngredients.split(",").map((ingredient) => ingredient.trim()),
      calories: parseInt(mealCalories, 10) || 0,
      protein: parseInt(mealProtein, 10) || 0,
      carbohydrates: parseInt(mealCarbohydrates, 10) || 0,
      fat: parseInt(mealFat, 10) || 0,
    };
=======

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (recipeLink && !youtubeRegex.test(recipeLink)) {
      Alert.alert("Error", "Please provide a valid YouTube link for the recipe.");
      return;
    }

    const formData = new FormData();
    formData.append("name", mealName);
    formData.append("description", mealDescription);
    formData.append("ingredients", JSON.stringify(mealIngredients.split(",").map((ingredient) => ingredient.trim())));
    formData.append("calories", mealCalories);
    formData.append("protein", mealProtein);
    formData.append("carbohydrates", mealCarbohydrates);
    formData.append("fat", mealFat);
    formData.append("instructions", mealInstructions);
    formData.append("recipeLink", recipeLink);
    formData.append("day", selectedDay);

    if (mealPicture) {
      const uriParts = mealPicture.split(".");
      const fileType = uriParts[uriParts.length - 1];
      formData.append("picture", {
        uri: mealPicture,
        name: `meal_picture.${fileType}`,
        type: `image/${fileType}`,
      } as any);
    }
>>>>>>> Stashed changes

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in again.");
        return;
      }

      const response = await fetch(`${BASE_URL}/meals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meal: newMeal, day: selectedDay }),
      });

      if (!response.ok) {
        throw new Error("Failed to add meal to the database.");
      }

      Alert.alert("Success", "Meal added successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error adding meal:", error);
      Alert.alert("Error", "Failed to add the meal to the database.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a New Meal</Text>
      <TextInput style={styles.input} placeholder="Meal Name" value={mealName} onChangeText={setMealName} />
      <TextInput style={styles.input} placeholder="Meal Description" value={mealDescription} onChangeText={setMealDescription} />
      <TextInput style={styles.input} placeholder="Ingredients (comma-separated)" value={mealIngredients} onChangeText={setMealIngredients} />
      <TextInput style={styles.input} placeholder="Calories" value={mealCalories} onChangeText={setMealCalories} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Protein (g)" value={mealProtein} onChangeText={setMealProtein} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Carbs (g)" value={mealCarbohydrates} onChangeText={setMealCarbohydrates} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Fat (g)" value={mealFat} onChangeText={setMealFat} keyboardType="numeric" />
<<<<<<< Updated upstream
=======
      <TextInput style={styles.input} placeholder="Instructions" value={mealInstructions} onChangeText={setMealInstructions} multiline numberOfLines={4} />
      <TextInput style={styles.input} placeholder="Recipe Link" value={recipeLink} onChangeText={setRecipeLink} />

      {/* Image Picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickMealImage}>
        <Text style={styles.imagePickerText}>Pick a Meal Image</Text>
      </TouchableOpacity>
      {mealPicture && <Image source={{ uri: mealPicture }} style={styles.mealPicture} />}

>>>>>>> Stashed changes
      <Button title="Create Meal" onPress={handleAddMeal} />
      <Button title="Add Meal" onPress={handleAddMeal} />
      <Button title="Cancel" onPress={() => navigation.goBack()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
    width: "80%",
  },
});

export default CreateMealScreen;