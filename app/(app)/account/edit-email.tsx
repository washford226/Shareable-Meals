import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const EditProfile = () => {
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
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

        // Fetch user profile from 'user_profiles' table
        const { data, error } = await supabase
          .from("user_profiles")
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

  const handleUpdateProfile = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!username || username.trim().length < 3) {
      Alert.alert("Invalid Username", "Username must be at least 3 characters long.");
      return;
    }

    // If user wants to change password, validate password fields
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        Alert.alert("Current Password Required", "Please enter your current password to change your password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Password Mismatch", "New password and confirm password do not match.");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert("Weak Password", "New password must be at least 6 characters long.");
        return;
      }
    }

    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        router.replace("/login");
        return;
      }
      const userId = userData.user.id;

      // Check if username is already taken by another user
      const { data: existingUser, error: checkError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("username", username)
        .neq("id", userId)
        .single();

      if (checkError && checkError.code !== "PGRST116") { // PGRST116 is "no rows returned"
        throw checkError;
      }

      if (existingUser) {
        Alert.alert("Username Taken", "This username is already taken. Please choose a different one.");
        return;
      }

      // Update email in Supabase Auth if it changed
      if (email !== userData.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) {
          Alert.alert("Error", emailError.message || "Failed to update email. Please try again.");
          return;
        }
      }

      // Update password if provided
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ 
          password: newPassword 
        });
        if (passwordError) {
          Alert.alert("Error", passwordError.message || "Failed to update password. Please try again.");
          return;
        }
      }

      // Update username in 'user_profiles' table
      const { error: userTableError } = await supabase
        .from("user_profiles")
        .update({ 
          username: username.trim()
        })
        .eq("id", userId);

      if (userTableError) {
        Alert.alert("Warning", "Profile updated in authentication, but not in user profile table.");
      }

      let successMessage = "Your profile has been updated successfully!";
      if (email !== userData.user.email) {
        successMessage += " Please check your inbox to confirm the new email.";
      }

      Alert.alert("Success", successMessage);
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      router.back();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", error.message || "An error occurred while updating your profile.");
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
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Information</Text>
        
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Username"
          placeholderTextColor={theme.placeholder}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Email address"
          placeholderTextColor={theme.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Change Password (Optional)</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.placeholder }]}>
          Leave blank if you don't want to change your password
        </Text>

        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Current password"
          placeholderTextColor={theme.placeholder}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={true}
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="New password"
          placeholderTextColor={theme.placeholder}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={true}
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Confirm new password"
          placeholderTextColor={theme.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={true}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.button }]}
        onPress={handleUpdateProfile}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.buttonText} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Update Profile</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: theme.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: "italic",
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
    marginTop: 8,
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
    marginBottom: 24,
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

export default EditProfile;
