import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator, ScrollView, Platform, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";
import { dietaryOptions } from "../../constants/dietaryOptions";

const SignUpScreen: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();

  // Safety check for theme
  if (!theme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const [username, setUsername] = useState("");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<null | boolean>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [caloriesGoal, setCaloriesGoal] = useState("");
  const [proteinGoal, setProteinGoal] = useState("");
  const [carbohydratesGoal, setCarbohydratesGoal] = useState("");
  const [fatGoal, setFatGoal] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Request permission for image picker
  useEffect(() => {
    (async () => {
      try {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      } catch (error) {
        console.error("Error requesting image picker permissions:", error);
      }
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
        
        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "no rows returned" which means username is available
          console.error("Username check error:", error);
          setIsUsernameAvailable(null);
        } else {
          setIsUsernameAvailable(!data);
        }
      } catch (e) {
        console.error("Username check exception:", e);
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

  // Handle dietary restrictions picker
  const showDietaryPicker = () => {
    // Use custom modal for both iOS and Android for consistent experience
    setShowDietaryModal(true);
  };

  // Pick image and convert to base64
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [3, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfilePicture(base64Image);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick an image.");
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
        options: {
          emailRedirectTo: 'https://shareablemeals.com/verify',
        },
      });

      if (signUpError) {
        Alert.alert("Signup Error", signUpError.message || "Failed to create account. Please try again.");
        return;
      }

      if (!signUpData?.user) {
        Alert.alert("Error", "Failed to create account. Please try again.");
        return;
      }

      const userId = signUpData.user.id;

      // Store profile picture data if present
      let profilePictureData = null;
      if (profilePicture) {
        // Store the full data URI (consistent with edit-user screen)
        profilePictureData = profilePicture;
      }

      // 2. Create user profile
      const profileData = {
        id: userId,
        username: username.trim(),
        calories_goal: caloriesGoal ? parseInt(caloriesGoal) : 2000,
        protein_goal: proteinGoal ? parseInt(proteinGoal) : 80,
        carbohydrates_goal: carbohydratesGoal ? parseInt(carbohydratesGoal) : 300,
        fat_goal: fatGoal ? parseInt(fatGoal) : 60,
        dietary_restrictions: dietaryRestrictions || null,
        allergies: allergies || null,
        profile_picture: profilePictureData,
        scanner_usage_count: 0,
      };

      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert([profileData]);

      if (profileError) {
        console.error("Profile creation error:", profileError);
        Alert.alert("Error", "Failed to create user profile. Please try again.");
        return;
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
      Alert.alert("Signup Failed", "Failed to create account. Please try again.");
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
              <Ionicons name="person" size={16} color={theme.subtext} style={styles.inputIcon} />
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
                placeholder="e.g., 2000 (default)"
                placeholderTextColor={theme.placeholder}
                value={caloriesGoal}
                onChangeText={setCaloriesGoal}
                keyboardType="numeric"
                editable={!isSigningUp}
              />
            </View>
          </View>

          {/* Protein Goal Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Daily Protein Goal (g)
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="fitness" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., 80 (default)"
                placeholderTextColor={theme.placeholder}
                value={proteinGoal}
                onChangeText={setProteinGoal}
                keyboardType="numeric"
                editable={!isSigningUp}
              />
            </View>
          </View>

          {/* Carbohydrates Goal Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Daily Carbohydrates Goal (g)
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="leaf" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., 300 (default)"
                placeholderTextColor={theme.placeholder}
                value={carbohydratesGoal}
                onChangeText={setCarbohydratesGoal}
                keyboardType="numeric"
                editable={!isSigningUp}
              />
            </View>
          </View>

          {/* Fat Goal Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Daily Fat Goal (g)
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="water" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="e.g., 60 (default)"
                placeholderTextColor={theme.placeholder}
                value={fatGoal}
                onChangeText={setFatGoal}
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
            <TouchableOpacity
              style={[styles.pickerContainer, { 
                borderColor: theme.border,
                backgroundColor: theme.background 
              }]}
              onPress={showDietaryPicker}
              disabled={isSigningUp}
              activeOpacity={0.7}
            >
              <Ionicons name="restaurant" size={16} color={theme.subtext} style={styles.inputIcon} />
              <Text style={[styles.pickerText, { 
                color: dietaryRestrictions ? theme.text : theme.placeholder 
              }]}>
                {dietaryRestrictions || "Select dietary restrictions"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.subtext} style={styles.dropdownIcon} />
            </TouchableOpacity>
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

      {/* Dietary Restrictions Modal */}
      <Modal
        visible={showDietaryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDietaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Select Dietary Restrictions
              </Text>
              <TouchableOpacity
                onPress={() => setShowDietaryModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {dietaryOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalOption,
                    { 
                      backgroundColor: dietaryRestrictions === option.value 
                        ? `${theme.primary}15` 
                        : 'transparent',
                      borderColor: dietaryRestrictions === option.value 
                        ? theme.primary 
                        : theme.border
                    }
                  ]}
                  onPress={() => {
                    setDietaryRestrictions(option.value);
                    setShowDietaryModal(false);
                  }}
                >
                  <View style={styles.modalOptionIcon}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={24} 
                      color={dietaryRestrictions === option.value ? theme.primary : theme.subtext} 
                    />
                  </View>
                  <View style={styles.modalOptionText}>
                    <Text style={[
                      styles.modalOptionTitle, 
                      { 
                        color: dietaryRestrictions === option.value ? theme.primary : theme.text 
                      }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.modalOptionDescription, { color: theme.subtext }]}>
                      {option.description}
                    </Text>
                  </View>
                  {dietaryRestrictions === option.value && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 160,
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
    paddingRight: 40,
    position: 'relative',
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  dropdownIcon: {
    position: 'absolute',
    right: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 14,
    lineHeight: 18,
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
