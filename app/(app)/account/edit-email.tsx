import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const EditEmail = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);

  const { theme } = useTheme();
  const router = useRouter();

  // Fetch the username and current email when the screen loads
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          Alert.alert("Error", "User not authenticated. Please log in.");
          router.replace("/login");
          return;
        }
        const userId = userData.user.id;

        // Fetch user profile from 'users' table
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          Alert.alert("Error", "Failed to fetch user information.");
          return;
        }

        setUsername(data.username ?? "");
        setEmail(userData.user.email ?? ""); // Set the email from auth user
      } catch (error) {
        console.error("Error fetching user:", error);
        Alert.alert("Error", "An error occurred while fetching user information.");
      } finally {
        setFetchingUser(false);
      }
    };

    fetchUser();
  }, []);

  const handleUpdateEmail = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!password) {
      Alert.alert("Invalid Password", "Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate user (Supabase does not require password for email update, but you may want to verify password yourself)
      // Update email in Supabase Auth
      const { data, error } = await supabase.auth.updateUser({ email });

      if (error) {
        Alert.alert("Error", error.message || "Failed to update email. Please try again.");
        return;
      }

      // Optionally, update email in your 'users' table as well
      const { error: userTableError } = await supabase
        .from("users")
        .update({ email })
        .eq("username", username);

      if (userTableError) {
        Alert.alert("Warning", "Email updated in authentication, but not in user profile table.");
      }

      Alert.alert("Success", "Your email has been updated! Please check your inbox to confirm the new email.");
      router.back();
    } catch (error: any) {
      console.error("Error updating email:", error);
      Alert.alert("Error", error.message || "An error occurred while updating your email.");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Fetching user information...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Edit Email</Text>

      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        placeholder="Enter new email"
        placeholderTextColor={theme.placeholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        placeholder="Enter your password"
        placeholderTextColor={theme.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.button }]}
        onPress={handleUpdateEmail}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.buttonText} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Update Email</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: theme.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
});

export default EditEmail;
