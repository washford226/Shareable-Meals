import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const logo = require("../../assets/images/logo-transparent-png.png"); // Update if needed

const LoginScreen = () => {
  const router = useRouter();

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
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <Text style={styles.title}>Login</Text>

      <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={handleEmailChange}
          textAlign="left"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          editable={!loading}
        />
      </View>
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

      <View style={[styles.passwordContainer, errors.password ? styles.inputError : null]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!isPasswordVisible}
          textAlign="left"
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.showPasswordButton}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          disabled={loading}
        >
          <Text style={styles.showPasswordText}>{isPasswordVisible ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>
      {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

      <TouchableOpacity 
        style={[styles.button, loading ? styles.buttonDisabled : null]} 
        onPress={handleLogin} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("../(auth)/signup")}
      >
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("../(auth)/forgot-password")}>
        <Text style={styles.forgotPasswordText}>Forgot password?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, width: "100%" },
  logo: { width: 120, height: 120, marginBottom: 16 },
  title: { fontSize: 24, marginBottom: 16 },
  inputContainer: { 
    width: "100%", 
    marginBottom: 8, 
    borderWidth: 1, 
    borderRadius: 8, 
    borderColor: "#ccc", 
    backgroundColor: "#fff", 
    paddingHorizontal: 8 
  },
  inputError: {
    borderColor: "#ff4444",
    borderWidth: 2,
  },
  input: { width: "100%", paddingVertical: 12, fontSize: 16 },
  passwordContainer: { 
    width: "100%", 
    flexDirection: "row", 
    alignItems: "center", 
    borderWidth: 1, 
    borderRadius: 8, 
    borderColor: "#ccc", 
    backgroundColor: "#fff", 
    marginBottom: 8, 
    paddingHorizontal: 8 
  },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  showPasswordButton: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: "#007bff" },
  showPasswordText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    marginBottom: 12,
    marginLeft: 4,
  },
  button: { 
    width: "100%", 
    paddingVertical: 12, 
    backgroundColor: "#007bff", 
    borderRadius: 8, 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 48,
  },
  buttonDisabled: {
    backgroundColor: "#cccccc",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  forgotPasswordText: { color: "#007bff", fontSize: 14, textAlign: "center", marginTop: 8 },
});

export default LoginScreen;
