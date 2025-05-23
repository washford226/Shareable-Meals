import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const getBaseUrl = () => {
    return Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
  };

  const handleForgotPassword = async () => {
    try {
      const response = await axios.post(`${getBaseUrl()}/users/forgot-password`, { email });

      if (response.status === 200) {
        const { username } = response.data;
        Alert.alert(
          "Success",
          `A password reset link has been sent to your email.\n\nUsername: ${username}`,
          [
            { text: "OK", onPress: () => router.replace("../(auth)/login") } // <-- Go back to login screen
          ]
        );
      }
    } catch (error) {
      console.error("Error sending forgot password email:", error);

      if ((error as any).response?.status === 404) {
        Alert.alert("Error", "No account found with this email.");
      } else {
        Alert.alert("Error", "Failed to send email. Please try again.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholderTextColor="#aaa"
      />
      <TouchableOpacity style={styles.button} onPress={handleForgotPassword}>
        <Text style={styles.buttonText}>Send Reset Link</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => router.back()} // <-- this goes back to previous screen
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#333",
  },
  input: {
    width: "80%",
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    fontSize: 16,
    color: "#333",
  },
  button: {
    width: "80%",
    padding: 12,
    backgroundColor: "#007bff",
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#f0f0f0",
  },
  secondaryButtonText: {
    color: "#007bff",
  },
});

export default ForgotPasswordScreen;
