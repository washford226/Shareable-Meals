import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "app/utils_supabase";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://your-app-url.com/reset-password", // Change to your app's reset password URL
      });

      if (error) {
        if (error.message.toLowerCase().includes("user not found")) {
          Alert.alert("Error", "No account found with this email.");
        } else {
          Alert.alert("Error", error.message || "Failed to send email. Please try again.");
        }
      } else {
        Alert.alert(
          "Success",
          "A password reset link has been sent to your email.",
          [
            { text: "OK", onPress: () => router.replace("../(auth)/login") }
          ]
        );
      }
    } catch (error) {
      console.error("Error sending forgot password email:", error);
      Alert.alert("Error", "Failed to send email. Please try again.");
    } finally {
      setLoading(false);
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
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Reset Link"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={() => router.back()}
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