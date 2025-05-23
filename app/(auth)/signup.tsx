import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, Platform } from "react-native";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";

const SignUpScreen: React.FC = () => {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [caloriesGoal, setCaloriesGoal] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState(""); // New state for allergies
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const dietaryOptions = [
    { label: "None", value: "None" },
    { label: "Vegetarian", value: "Vegetarian" },
    { label: "Vegan", value: "Vegan" },
    { label: "Gluten-Free", value: "Gluten-Free" },
    { label: "Keto", value: "Keto" },
    { label: "Paleo", value: "Paleo" },
  ];

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "We need access to your gallery to pick an image.");
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  const getBaseUrl = () => {
    return Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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

        if (result.assets[0].fileSize && result.assets[0].fileSize > 5 * 1024 * 1024) {
          Alert.alert("Error", "File size exceeds the limit of 5 MB.");
          return;
        }

        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick an image.");
    }
  };

const handleSignUp = async () => {
  if (isSigningUp) return; // Prevent multiple submissions
  setIsSigningUp(true); // Disable the button

  if (!username || !email || !password || !confirmPassword) {
    Alert.alert("Error", "All fields are required");
    setIsSigningUp(false); // Re-enable the button
    return;
  }

  if (password !== confirmPassword) {
    Alert.alert("Error", "Passwords do not match");
    setIsSigningUp(false); // Re-enable the button
    return;
  }

  if (!validateEmail(email)) {
    Alert.alert("Error", "Invalid email format");
    setIsSigningUp(false); // Re-enable the button
    return;
  }

  const formData = new FormData();
  formData.append("username", username);
  formData.append("email", email);
  formData.append("password", password);
  if (caloriesGoal) formData.append("calories_goal", caloriesGoal);
  if (dietaryRestrictions) formData.append("dietary_restrictions", dietaryRestrictions);
  if (allergies) formData.append("allergies", allergies); // Add allergies to the form data
  if (profilePicture) {
    const uriParts = profilePicture.split(".");
    const fileType = uriParts[uriParts.length - 1];
    formData.append("profile_picture", {
      uri: profilePicture,
      name: `profile_picture.${fileType}`,
      type: `image/${fileType}`,
    } as any);
  }

  try {
    const response = await axios.post(`${getBaseUrl()}/users/signup`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    if (response.status === 200) {
      Alert.alert("Success", "User signed up successfully", [
        {
          text: "OK",
          onPress: () => router.replace("../login"), // Navigate to login after signup
        },
      ]);
    }
  } catch (error) {
    if ((error as any).response && (error as any).response.data) {
      const errorMessage = (error as any).response?.data?.message || "Failed to sign up";
      Alert.alert("Error", errorMessage);
    } else {
      Alert.alert("Error", "Failed to sign up");
    }
    console.error("Error signing up:", error);
  } finally {
    setIsSigningUp(false); // Re-enable the button after the process is complete
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
        />
        <TouchableOpacity
          style={styles.showPasswordButton}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        >
          <Text>{isPasswordVisible ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!isPasswordVisible}
      />
      <TextInput
        style={styles.input}
        placeholder="Calories Goal (optional)"
        value={caloriesGoal}
        onChangeText={setCaloriesGoal}
        keyboardType="numeric"
      />
      <RNPickerSelect
        onValueChange={(value) => setDietaryRestrictions(value)}
        items={dietaryOptions}
        placeholder={{
          label: "Select Dietary Restrictions (optional)",
          value: null,
        }}
        style={{
          inputIOS: styles.pickerInput,
          inputAndroid: styles.pickerInput,
        }}
        value={dietaryRestrictions}
      />
      <TextInput
        style={styles.input}
        placeholder="Allergies (optional)" // New input for allergies
        value={allergies}
        onChangeText={setAllergies}
      />
      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
        <Text style={styles.uploadButtonText}>Upload Profile Picture (optional)</Text>
      </TouchableOpacity>
      {profilePicture && (
        <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
      )}
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}>
        <Text style={styles.buttonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    width: "100%",
  },
  pickerInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  showPasswordButton: {
    marginLeft: 8,
  },
  uploadButton: {
    width: "100%",
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  profilePicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#ccc",
  },
  button: {
    width: "100%",
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SignUpScreen;
