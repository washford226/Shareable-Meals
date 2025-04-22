import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

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
  const [mealPicture, setMealPicture] = useState<string | null>(null);

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

  const handleAddMeal = async () => {
    if (!mealName || !mealDescription || !mealIngredients) {
      Alert.alert("Error", "Please fill in all required fields.");
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

      {/* Image Picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickMealImage}>
        <Text style={styles.imagePickerText}>Pick a Meal Image</Text>
      </TouchableOpacity>
      {mealPicture && <Image source={{ uri: mealPicture }} style={styles.mealPicture} />}

      <Button title="Create Meal" onPress={handleAddMeal} />
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
  imagePicker: {
    backgroundColor: "#007BFF",
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  imagePickerText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  mealPicture: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "#ccc",
  },
});

export default CreateMealScreen;