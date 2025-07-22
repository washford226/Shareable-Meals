import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [originalEmail, setOriginalEmail] = useState<string>("");

  const { theme } = useTheme();
  const router = useRouter();

  // Enhanced fetch function with retry logic
  const fetchUser = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setFetchingUser(true);
      }
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Fetch user profile from 'user_profiles' table
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        throw new Error("Failed to fetch user information.");
      }

      setUsername(data.username ?? "");
      setEmail(userData.user.email ?? "");
      setOriginalEmail(userData.user.email ?? "");
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      const errorMessage = error.message || "An error occurred while fetching user information.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/login") }
        ]);
      }
    } finally {
      setFetchingUser(false);
      setRefreshing(false);
    }
  }, [router]);

  // Retry function with exponential backoff
  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 16000);
    
    setTimeout(() => {
      fetchUser();
    }, delay);
  }, [retryCount, fetchUser]);

  // Fetch the username and current email when the screen loads
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Validation functions
  const validateForm = useCallback(() => {
    const errors: {[key: string]: string} = {};

    // Email validation
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Username validation
    if (!username.trim()) {
      errors.username = "Username is required";
    } else if (username.trim().length < 3) {
      errors.username = "Username must be at least 3 characters long";
    } else if (username.trim().length > 30) {
      errors.username = "Username must be 30 characters or less";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errors.username = "Username can only contain letters, numbers, and underscores";
    }

    // Password validation (only if user is trying to change password)
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        errors.currentPassword = "Current password is required to change password";
      }
      
      if (newPassword && newPassword.length < 6) {
        errors.newPassword = "New password must be at least 6 characters long";
      }
      
      if (newPassword !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, username, currentPassword, newPassword, confirmPassword]);

  // Form field handlers with validation
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: '' }));
    }
  }, [validationErrors.email]);

  const handleUsernameChange = useCallback((value: string) => {
    setUsername(value);
    if (validationErrors.username) {
      setValidationErrors(prev => ({ ...prev, username: '' }));
    }
  }, [validationErrors.username]);

  const handleCurrentPasswordChange = useCallback((value: string) => {
    setCurrentPassword(value);
    if (validationErrors.currentPassword) {
      setValidationErrors(prev => ({ ...prev, currentPassword: '' }));
    }
  }, [validationErrors.currentPassword]);

  const handleNewPasswordChange = useCallback((value: string) => {
    setNewPassword(value);
    if (validationErrors.newPassword) {
      setValidationErrors(prev => ({ ...prev, newPassword: '' }));
    }
  }, [validationErrors.newPassword]);

  const handleConfirmPasswordChange = useCallback((value: string) => {
    setConfirmPassword(value);
    if (validationErrors.confirmPassword) {
      setValidationErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  }, [validationErrors.confirmPassword]);

  const isFormValid = useCallback(() => {
    return email.trim() && username.trim() && Object.keys(validationErrors).length === 0;
  }, [email, username, validationErrors]);

  const hasChanges = useCallback(() => {
    return email !== originalEmail || 
           username.trim() !== username || 
           newPassword.trim() !== "";
  }, [email, originalEmail, username, newPassword]);

  // Enhanced update function with comprehensive validation
  const handleUpdateProfile = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the form errors before submitting.");
      return;
    }

    if (!hasChanges()) {
      Alert.alert("No Changes", "No changes detected to update.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      // Check if username is already taken by another user
      if (username.trim() !== userData.user.user_metadata?.username) {
        const { data: existingUser, error: checkError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("username", username.trim())
          .neq("id", userId)
          .single();

        if (checkError && checkError.code !== "PGRST116") { // PGRST116 is "no rows returned"
          throw checkError;
        }

        if (existingUser) {
          throw new Error("This username is already taken. Please choose a different one.");
        }
      }

      // Update email in Supabase Auth if it changed
      if (email !== originalEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) {
          throw new Error(emailError.message || "Failed to update email. Please try again.");
        }
      }

      // Update password if provided
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ 
          password: newPassword 
        });
        if (passwordError) {
          throw new Error(passwordError.message || "Failed to update password. Please try again.");
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
        console.warn("User table update error:", userTableError);
        // Don't throw here as auth updates succeeded
      }

      let successMessage = "Your profile has been updated successfully!";
      if (email !== originalEmail) {
        successMessage += " Please check your inbox to confirm the new email.";
      }

      Alert.alert("Success", successMessage, [
        { text: "OK", onPress: () => {
          // Clear password fields
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          router.back();
        }}
      ]);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      const errorMessage = error.message || "An error occurred while updating your profile.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/login") }
        ]);
      } else {
        Alert.alert("Update Error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [validateForm, hasChanges, email, originalEmail, username, newPassword, router]);

  // Enhanced loading state
  if (fetchingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Fetching user information...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchUser(true)}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.primary }]}>
          <Text style={[styles.retryBannerText, { color: theme.primary }]}>
            Retrying... (Attempt {retryCount})
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Information</Text>
        
        {/* Username Section */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Username *</Text>
          <Text style={[styles.characterCount, { color: theme.subtext }]}>
            {username.length}/30
          </Text>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: validationErrors.username ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card
              }
            ]}
            placeholder="Username"
            placeholderTextColor={theme.placeholder}
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            maxLength={30}
            editable={!loading}
          />
          {validationErrors.username && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.username}</Text>
          )}
        </View>

        {/* Email Section */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Email Address *</Text>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: validationErrors.email ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card
              }
            ]}
            placeholder="Email address"
            placeholderTextColor={theme.placeholder}
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          {validationErrors.email && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.email}</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Change Password (Optional)</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.placeholder }]}>
          Leave blank if you don't want to change your password
        </Text>

        {/* Current Password Section */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Current Password</Text>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: validationErrors.currentPassword ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card
              }
            ]}
            placeholder="Current password"
            placeholderTextColor={theme.placeholder}
            value={currentPassword}
            onChangeText={handleCurrentPasswordChange}
            secureTextEntry={true}
            autoCapitalize="none"
            editable={!loading}
          />
          {validationErrors.currentPassword && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.currentPassword}</Text>
          )}
        </View>

        {/* New Password Section */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>New Password</Text>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: validationErrors.newPassword ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card
              }
            ]}
            placeholder="New password"
            placeholderTextColor={theme.placeholder}
            value={newPassword}
            onChangeText={handleNewPasswordChange}
            secureTextEntry={true}
            autoCapitalize="none"
            editable={!loading}
          />
          {validationErrors.newPassword && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.newPassword}</Text>
          )}
        </View>

        {/* Confirm Password Section */}
        <View style={styles.formSection}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Confirm New Password</Text>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: validationErrors.confirmPassword ? theme.danger : theme.border, 
                color: theme.text,
                backgroundColor: theme.card
              }
            ]}
            placeholder="Confirm new password"
            placeholderTextColor={theme.placeholder}
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            secureTextEntry={true}
            autoCapitalize="none"
            editable={!loading}
          />
          {validationErrors.confirmPassword && (
            <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.confirmPassword}</Text>
          )}
        </View>
      </View>

      {/* Button Container */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button, 
            { 
              backgroundColor: isFormValid() && hasChanges() && !loading ? theme.primary : theme.border,
              opacity: loading ? 0.6 : 1
            }
          ]}
          onPress={handleUpdateProfile}
          disabled={!isFormValid() || !hasChanges() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Update Profile</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.border, opacity: loading ? 0.6 : 1 }]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
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
  formSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
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
});

export default EditProfile;
