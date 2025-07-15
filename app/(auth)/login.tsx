import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const logo = require("../../assets/images/logo-transparent-png.png"); // Update if needed

const LoginScreen = () => {
  const router = useRouter();

  const [email, setEmail] = useState(""); // Supabase uses email for login
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert("Error", error.message || "Invalid email or password.");
      } else {
        router.replace("../meal-plan/calendar");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <Text style={styles.title}>Login</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          textAlign="left"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
      </View>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          textAlign="left"
        />
        <TouchableOpacity
          style={styles.showPasswordButton}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        >
          <Text style={styles.showPasswordText}>{isPasswordVisible ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
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
  inputContainer: { width: "100%", marginBottom: 16, borderWidth: 1, borderRadius: 8, borderColor: "#ccc", backgroundColor: "#fff", paddingHorizontal: 8 },
  input: { width: "100%", paddingVertical: 12, fontSize: 16 },
  passwordContainer: { width: "100%", flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, borderColor: "#ccc", backgroundColor: "#fff", marginBottom: 16, paddingHorizontal: 8 },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  showPasswordButton: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: "#007bff" },
  showPasswordText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  button: { width: "100%", paddingVertical: 12, backgroundColor: "#007bff", borderRadius: 8, alignItems: "center", marginBottom: 16 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  forgotPasswordText: { color: "#007bff", fontSize: 14, textAlign: "center", marginTop: 8 },
});

export default LoginScreen;
