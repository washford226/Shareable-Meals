import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";

const SignUpScreen: React.FC = () => {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<null | boolean>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [caloriesGoal, setCaloriesGoal] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState("");
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

  // Request permission for image picker
  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  // Username check effect (Supabase: check if username exists in profiles)
  useEffect(() => {
    if (!username) {
      setIsUsernameAvailable(null);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("username")
          .eq("username", username)
          .single();
        setIsUsernameAvailable(!data);
      } catch (e) {
        setIsUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [username]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Pick image and upload to Supabase Storage
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setProfilePicture(uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick an image.");
    }
  };

  // Upload image to Supabase Storage and return public URL
  const uploadProfilePicture = async (userId: string, uri: string) => {
    try {
      const fileExt = uri.split(".").pop();
      const fileName = `${userId}.${fileExt}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from("profile-pictures")
        .upload(fileName, blob, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      return null;
    }
  };

  const handleSignUp = async () => {
    setIsSigningUp(true);

    if (!username || !email || !password || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      setIsSigningUp(false);
      return;
    }

    if (isUsernameAvailable === false) {
      Alert.alert("Error", "Username is already taken");
      setIsSigningUp(false);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      setIsSigningUp(false);
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Error", "Invalid email format");
      setIsSigningUp(false);
      return;
    }

    try {
      // 1. Sign up user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError || !signUpData?.user) {
        Alert.alert("Error", signUpError?.message || "Failed to sign up");
        setIsSigningUp(false);
        return;
      }

      const userId = signUpData.user.id;

      // 2. Upload profile picture if provided
      let profilePictureUrl: string | null = null;
      if (profilePicture) {
        profilePictureUrl = await uploadProfilePicture(userId, profilePicture);
      }

      // 3. Insert user profile in 'user_profiles' table
      const { error: profileError } = await supabase.from("user_profiles").upsert([
        {
          id: userId,
          username,
          calories_goal: caloriesGoal ? parseInt(caloriesGoal) : null,
          dietary_restrictions: dietaryRestrictions,
          allergies,
          profile_picture: profilePictureUrl,
        },
      ]);

      if (profileError) {
        Alert.alert("Error", profileError.message || "Failed to save profile.");
        setIsSigningUp(false);
        return;
      }

      Alert.alert(
        "Success",
        "Account created! Please check your email to confirm your account.",
        [
          {
            text: "OK",
            onPress: () => router.replace("../login"),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to sign up");
      console.error("Error signing up:", error);
    } finally {
      setIsSigningUp(false);
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
        autoCapitalize="none"
      />
      {checkingUsername && (
        <Text style={{ color: "#007bff", marginBottom: 5 }}>Checking username...</Text>
      )}
      {isUsernameAvailable === false && (
        <Text style={{ color: "red", marginBottom: 5 }}>Username is taken</Text>
      )}
      {isUsernameAvailable === true && (
        <Text style={{ color: "green", marginBottom: 5 }}>Username is available</Text>
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
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
        placeholder="Allergies (optional)"
        value={allergies}
        onChangeText={setAllergies}
      />
      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
        <Text style={styles.uploadButtonText}>Upload Profile Picture (optional)</Text>
      </TouchableOpacity>
      {profilePicture && (
        <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
      )}
      {isSigningUp ? (
        <ActivityIndicator size="large" color="#007bff" style={{ marginVertical: 20 }} />
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={handleSignUp}
          disabled={isUsernameAvailable === false}
        >
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/login")}
        disabled={isSigningUp}
      >
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
