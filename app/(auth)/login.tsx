import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Image, Platform } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const logo = require("../../assets/images/logo-transparent-png.png"); // Update if needed

const LoginScreen = () => {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async () => {
    try {
      const response = await axios.post(
        `${Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000"}/login`,
        { username, password }
      );

      if (response.status === 200) {
        const { token } = response.data;
        await AsyncStorage.setItem("token", token);
        router.replace("../meal-plan/calendar"); // Adjusted to use a relative path
      }
    } catch (error) {
      Alert.alert("Error", "Invalid username or password.");
    }
  };

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <Text style={styles.title}>Login</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          textAlign="left"
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

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("../(auth)/signup")} // Assuming you have a SignUpScreen
      >
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("../(auth)/forgot-password")}>
        <Text style={styles.forgotPasswordText}>Forgot username or password?</Text>
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
