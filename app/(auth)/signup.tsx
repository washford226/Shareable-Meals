import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator, ScrollView, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";

const SignUpScreen: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();

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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Join us to start your meal planning journey
          </Text>
        </View>

        {/* Account Information Card */}
        <View style={[styles.accountCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-add" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Account Information
            </Text>
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Username
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="at" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: errors.username ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Choose a unique username"
                placeholderTextColor={theme.placeholder}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                editable={!isSigningUp}
              />
              {checkingUsername && (
                <ActivityIndicator 
                  size="small" 
                  color={theme.primary} 
                  style={styles.checkingIndicator}
                />
              )}
            </View>
            {errors.username && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.username}
                </Text>
              </View>
            )}
            {checkingUsername && !errors.username && (
              <View style={[styles.infoContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="time" size={14} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.primary }]}>
                  Checking username availability...
                </Text>
              </View>
            )}
            {isUsernameAvailable === false && !errors.username && (
              <View style={[styles.errorContainer, { backgroundColor: `${theme.danger}15` }]}>
                <Ionicons name="close-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  Username is already taken
                </Text>
              </View>
            )}
            {isUsernameAvailable === true && !errors.username && (
              <View style={[styles.successContainer, { backgroundColor: `${theme.success}15` }]}>
                <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                <Text style={[styles.successText, { color: theme.success }]}>
                  Username is available
                </Text>
              </View>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Email Address
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: errors.email ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSigningUp}
              />
            </View>
            {errors.email && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.email}
                </Text>
              </View>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: errors.password ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background,
                  paddingRight: 48
                }]}
                placeholder="Create a secure password"
                placeholderTextColor={theme.placeholder}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!isPasswordVisible}
                editable={!isSigningUp}
              />
              <TouchableOpacity
                style={[styles.passwordToggle, { backgroundColor: theme.background }]}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={isSigningUp}
              >
                <Ionicons 
                  name={isPasswordVisible ? "eye-off" : "eye"} 
                  size={16} 
                  color={theme.subtext} 
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.password}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Confirm Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="checkmark-circle" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: errors.confirmPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.placeholder}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!isPasswordVisible}
                editable={!isSigningUp}
              />
            </View>
            {errors.confirmPassword && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.confirmPassword}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Profile Information Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Profile Information
            </Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.subtext }]}>
            Optional: Complete your profile to get personalized meal recommendations
          </Text>

          {/* Profile Picture */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Profile Picture
            </Text>
            <TouchableOpacity 
              style={[styles.imagePickerButton, { 
                borderColor: theme.border,
                backgroundColor: theme.background 
              }]} 
              onPress={pickImage}
              disabled={isSigningUp}
            >
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.profilePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color={theme.subtext} />
                  <Text style={[styles.imagePlaceholderText, { color: theme.subtext }]}>
                    Tap to add photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Calories Goal Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Daily Calories Goal
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="flame" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., 2000"
                placeholderTextColor={theme.placeholder}
                value={caloriesGoal}
                onChangeText={setCaloriesGoal}
                keyboardType="numeric"
                editable={!isSigningUp}
              />
            </View>
          </View>

          {/* Dietary Restrictions Picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Dietary Restrictions
            </Text>
            <View style={[styles.pickerContainer, { 
              borderColor: theme.border,
              backgroundColor: theme.background 
            }]}>
              <Ionicons name="restaurant" size={16} color={theme.subtext} style={styles.inputIcon} />
              <RNPickerSelect
                onValueChange={(value) => setDietaryRestrictions(value)}
                items={dietaryOptions}
                placeholder={{
                  label: "Select dietary restrictions",
                  value: null,
                  color: theme.placeholder,
                }}
                style={{
                  inputIOS: [styles.pickerInput, { color: theme.text }],
                  inputAndroid: [styles.pickerInput, { color: theme.text }],
                  placeholder: { color: theme.placeholder },
                }}
                value={dietaryRestrictions}
                disabled={isSigningUp}
              />
            </View>
          </View>

          {/* Allergies Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Allergies
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="medical" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., nuts, dairy, shellfish"
                placeholderTextColor={theme.placeholder}
                value={allergies}
                onChangeText={setAllergies}
                editable={!isSigningUp}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.signupButton, 
              { 
                backgroundColor: (!username || !email || !password || !confirmPassword || isUsernameAvailable === false || isSigningUp) 
                  ? theme.border 
                  : theme.primary,
                opacity: isSigningUp ? 0.8 : 1
              }
            ]}
            onPress={handleSignUp}
            disabled={!username || !email || !password || !confirmPassword || isUsernameAvailable === false || isSigningUp}
          >
            {isSigningUp ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="person-add" size={16} color={theme.buttonText} />
                <Text style={[styles.signupButtonText, { color: theme.buttonText }]}>
                  Create Account
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, { 
              borderColor: theme.border,
              backgroundColor: theme.background 
            }]}
            onPress={() => router.replace("/login")}
            disabled={isSigningUp}
          >
            <Ionicons name="arrow-back" size={16} color={theme.text} />
            <Text style={[styles.loginButtonText, { color: theme.text }]}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },
  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Card Styles
  accountCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  // Input Styles
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingLeft: 40,
    paddingRight: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 16,
  },
  checkingIndicator: {
    position: 'absolute',
    right: 12,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 8,
    borderRadius: 6,
  },
  // Status Container Styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    padding: 8,
    borderRadius: 6,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    padding: 8,
    borderRadius: 6,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    padding: 8,
    borderRadius: 6,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
  },
  successText: {
    fontSize: 12,
    flex: 1,
  },
  // Profile Picture Styles
  imagePickerButton: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profilePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Picker Styles
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 12,
  },
  pickerInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  // Button Styles
  buttonContainer: {
    gap: 12,
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SignUpScreen;
