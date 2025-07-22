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
  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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

  // Validation functions
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateUsername = (username: string) => {
    return username.trim().length >= 3 && /^[a-zA-Z0-9_]+$/.test(username.trim());
  };

  // Clear errors when user types
  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (errors.username) {
      setErrors(prev => ({ ...prev, username: "" }));
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: "" }));
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: "" }));
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (errors.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: "" }));
    }
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
    // Reset errors
    setErrors({ username: "", email: "", password: "", confirmPassword: "" });
    
    // Comprehensive validation
    let hasErrors = false;
    const newErrors = { username: "", email: "", password: "", confirmPassword: "" };

    // Username validation
    if (!username.trim()) {
      newErrors.username = "Username is required";
      hasErrors = true;
    } else if (!validateUsername(username)) {
      newErrors.username = "Username must be at least 3 characters and contain only letters, numbers, and underscores";
      hasErrors = true;
    } else if (isUsernameAvailable === false) {
      newErrors.username = "This username is already taken";
      hasErrors = true;
    } else if (isUsernameAvailable === null && username.trim()) {
      newErrors.username = "Please wait while we check username availability";
      hasErrors = true;
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required";
      hasErrors = true;
    } else if (!validateEmail(email.trim())) {
      newErrors.email = "Please enter a valid email address";
      hasErrors = true;
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
      hasErrors = true;
    } else if (!validatePassword(password)) {
      newErrors.password = "Password must be at least 6 characters long";
      hasErrors = true;
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
      hasErrors = true;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsSigningUp(true);

    try {
      // 1. Sign up user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signUpError) {
        // Handle specific Supabase errors
        if (signUpError.message.includes('User already registered')) {
          Alert.alert("Account Exists", "An account with this email already exists. Please try logging in instead.");
        } else if (signUpError.message.includes('Password should be at least 6 characters')) {
          Alert.alert("Weak Password", "Password must be at least 6 characters long.");
        } else if (signUpError.message.includes('Invalid email')) {
          Alert.alert("Invalid Email", "Please enter a valid email address.");
        } else {
          Alert.alert("Signup Error", signUpError.message || "Failed to create account. Please try again.");
        }
        return;
      }

      if (!signUpData?.user) {
        Alert.alert("Error", "Failed to create account. Please try again.");
        return;
      }
      const userId = signUpData.user.id;

      // 2. Upload profile picture if provided
      let profilePictureUrl: string | null = null;
      if (profilePicture) {
        profilePictureUrl = await uploadProfilePicture(userId, profilePicture);
        if (!profilePictureUrl) {
          console.warn("Failed to upload profile picture, but continuing with signup");
        }
      }

      // 3. Insert user profile in 'user_profiles' table
      const { error: profileError } = await supabase.from("user_profiles").upsert([
        {
          id: userId,
          username: username.trim(),
          email: email.trim().toLowerCase(),
          calories_goal: caloriesGoal ? parseInt(caloriesGoal) : null,
          dietary_restrictions: dietaryRestrictions || null,
          allergies: allergies || null,
          profile_picture: profilePictureUrl,
        },
      ]);

      if (profileError) {
        console.error("Profile creation error:", profileError);
        Alert.alert("Warning", "Account created but profile setup failed. You can complete your profile later in account settings.");
      }

      Alert.alert(
        "Success", 
        "Account created successfully! Please check your email to confirm your account before signing in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("../login"),
          },
        ]
      );

    } catch (error) {
      console.error("Signup error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      Alert.alert("Signup Failed", `Failed to create account: ${errorMessage}. Please try again.`);
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      
      {/* Username Input */}
      <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={handleUsernameChange}
          autoCapitalize="none"
          editable={!isSigningUp}
        />
      </View>
      {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
      {checkingUsername && (
        <Text style={styles.infoText}>Checking username availability...</Text>
      )}
      {isUsernameAvailable === false && !errors.username && (
        <Text style={styles.errorText}>Username is already taken</Text>
      )}
      {isUsernameAvailable === true && !errors.username && (
        <Text style={styles.successText}>Username is available</Text>
      )}

      {/* Email Input */}
      <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isSigningUp}
        />
      </View>
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

      {/* Password Input */}
      <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!isPasswordVisible}
          editable={!isSigningUp}
        />
        <TouchableOpacity
          style={styles.showPasswordButton}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          disabled={isSigningUp}
        >
          <Text style={styles.showPasswordText}>{isPasswordVisible ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>
      {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

      {/* Confirm Password Input */}
      <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry={!isPasswordVisible}
          editable={!isSigningUp}
        />
      </View>
      {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
  },
  inputError: {
    borderColor: "#ff4444",
    borderWidth: 2,
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
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  infoText: {
    color: "#007bff",
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  successText: {
    color: "#28a745",
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  showPasswordButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#007bff",
  },
  showPasswordText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
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
    minHeight: 48,
  },
  buttonDisabled: {
    backgroundColor: "#cccccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SignUpScreen;
