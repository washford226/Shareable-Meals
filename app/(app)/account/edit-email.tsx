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
  Platform,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { Ionicons } from '@expo/vector-icons';

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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.headerBackButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Edit Profile
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading profile information...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Edit Profile
        </Text>
        <View style={styles.headerActions} />
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={16} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <ActivityIndicator size="small" color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retrying... (Attempt {retryCount})
          </Text>
        </View>
      )}

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUser(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Information Card */}
        <View style={[styles.basicInfoCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Basic Information
            </Text>
          </View>

          {/* Username Section */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Username
            </Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Ionicons name="at" size={16} color={theme.subtext} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { 
                    borderColor: validationErrors.username ? theme.danger : theme.border, 
                    color: theme.text,
                    backgroundColor: theme.background 
                  }]}
                  placeholder="Enter your username"
                  placeholderTextColor={theme.placeholder}
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  maxLength={30}
                  editable={!loading}
                />
              </View>
              <Text style={[styles.characterCount, { color: theme.subtext }]}>
                {username.length}/30
              </Text>
            </View>
            {validationErrors.username && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.username}
                </Text>
              </View>
            )}
          </View>

          {/* Email Section */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Email Address
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: validationErrors.email ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            {validationErrors.email && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.email}
                </Text>
              </View>
            )}
            {email !== originalEmail && (
              <View style={[styles.infoContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="information-circle" size={14} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.primary }]}>
                  Email verification will be required for the new address
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Password Change Card */}
        <View style={[styles.passwordCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Change Password
            </Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.subtext }]}>
            Leave blank if you don't want to change your password
          </Text>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Current Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: validationErrors.currentPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter current password"
                placeholderTextColor={theme.placeholder}
                value={currentPassword}
                onChangeText={handleCurrentPasswordChange}
                secureTextEntry={true}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            {validationErrors.currentPassword && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.currentPassword}
                </Text>
              </View>
            )}
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              New Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-open" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: validationErrors.newPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.placeholder}
                value={newPassword}
                onChangeText={handleNewPasswordChange}
                secureTextEntry={true}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            {validationErrors.newPassword && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.newPassword}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Confirm New Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="checkmark-circle" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: validationErrors.confirmPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.placeholder}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={true}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            {validationErrors.confirmPassword && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.confirmPassword}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.updateButton, 
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
              <>
                <Ionicons name="save" size={16} color={theme.buttonText} />
                <Text style={[styles.updateButtonText, { color: theme.buttonText }]}>
                  Update Profile
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { 
              borderColor: theme.border, 
              backgroundColor: theme.background,
              opacity: loading ? 0.6 : 1 
            }]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="close" size={16} color={theme.text} />
            <Text style={[styles.cancelButtonText, { color: theme.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 12,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    width: 36,
  },
  // Loading States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  // Content Layout
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  // Error and Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Card Styles
  basicInfoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  passwordCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  // Form Input Styles
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    gap: 4,
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
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  // Error and Info Styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  // Button Styles
  buttonContainer: {
    gap: 12,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default EditProfile;
