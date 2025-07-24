import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";

const logo = require("../../assets/images/logo-transparent-png.png"); // Update if needed

const LoginScreen = () => {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState(""); // Supabase uses email for login
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Clear errors when user types
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

  const handleLogin = async () => {
    // Reset errors
    setErrors({ email: "", password: "" });
    
    // Validation
    let hasErrors = false;
    const newErrors = { email: "", password: "" };

    if (!email.trim()) {
      newErrors.email = "Email is required";
      hasErrors = true;
    } else if (!validateEmail(email.trim())) {
      newErrors.email = "Please enter a valid email address";
      hasErrors = true;
    }

    if (!password) {
      newErrors.password = "Password is required";
      hasErrors = true;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        // Handle specific error types
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert("Login Failed", "Invalid email or password. Please check your credentials and try again.");
        } else if (error.message.includes('Email not confirmed')) {
          Alert.alert("Email Not Verified", "Please check your email and click the verification link before signing in.");
        } else if (error.message.includes('Too many requests')) {
          Alert.alert("Too Many Attempts", "Too many login attempts. Please wait a moment before trying again.");
        } else {
          Alert.alert("Login Error", error.message || "An error occurred during login.");
        }
      } else {
        // Success - navigate to main app
        router.replace("../meal-plan/calendar");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image source={logo} style={styles.logo} />
          <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Sign in to continue to your meal planning
          </Text>
        </View>

        {/* Login Card */}
        <View style={[styles.loginCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="log-in" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Sign In
            </Text>
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
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
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
                placeholder="Enter your password"
                placeholderTextColor={theme.placeholder}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!isPasswordVisible}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.passwordToggle, { backgroundColor: theme.background }]}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={loading}
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

          {/* Forgot Password Link */}
          <TouchableOpacity 
            style={styles.forgotPasswordContainer}
            onPress={() => router.push("../(auth)/forgot-password")}
            disabled={loading}
          >
            <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
              Forgot your password?
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity 
            style={[
              styles.loginButton, 
              { 
                backgroundColor: (!email || !password || loading) ? theme.border : theme.primary,
                opacity: loading ? 0.8 : 1
              }
            ]} 
            onPress={handleLogin} 
            disabled={!email || !password || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="log-in" size={16} color={theme.buttonText} />
                <Text style={[styles.loginButtonText, { color: theme.buttonText }]}>
                  Sign In
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Section */}
        <View style={[styles.signupCard, { backgroundColor: theme.card }]}>
          <View style={styles.signupContent}>
            <Text style={[styles.signupText, { color: theme.subtext }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity
              style={[styles.signupButton, { 
                borderColor: theme.primary,
                backgroundColor: theme.background 
              }]}
              onPress={() => router.push("../(auth)/signup")}
              disabled={loading}
            >
              <Ionicons name="person-add" size={16} color={theme.primary} />
              <Text style={[styles.signupButtonText, { color: theme.primary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },
  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: { 
    width: 120, 
    height: 120, 
    marginBottom: 16 
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Login Card
  loginCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
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
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 8,
    borderRadius: 6,
  },
  // Error Styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  // Forgot Password
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: { 
    fontSize: 14,
    fontWeight: '500',
  },
  // Login Button
  loginButton: {
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
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Sign Up Card
  signupCard: {
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  signupContent: {
    alignItems: 'center',
    gap: 16,
  },
  signupText: {
    fontSize: 16,
    textAlign: 'center',
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoginScreen;
