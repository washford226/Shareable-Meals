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

const EditPassword = () => {
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

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
      setEmail(userData.user.email ?? "");
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

  // Fetch the current user's email for re-authentication
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Validation functions
  const validateForm = useCallback(() => {
    const errors: {[key: string]: string} = {};

    if (!currentPassword.trim()) {
      errors.currentPassword = "Current password is required";
    }

    if (!newPassword.trim()) {
      errors.newPassword = "New password is required";
    } else if (newPassword.length < 6) {
      errors.newPassword = "New password must be at least 6 characters long";
    } else if (newPassword.length > 128) {
      errors.newPassword = "New password must be 128 characters or less";
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Check if new password is same as current (basic check)
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = "New password must be different from current password";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  // Form field handlers with validation
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
    return currentPassword.trim() && 
           newPassword.trim() && 
           confirmPassword.trim() && 
           Object.keys(validationErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword, validationErrors]);

  const getPasswordStrength = useCallback(() => {
    if (!newPassword) return { strength: 0, label: '' };
    
    let strength = 0;
    let label = 'Very Weak';
    
    if (newPassword.length >= 6) strength++;
    if (newPassword.length >= 8) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength++;
    
    if (strength >= 6) label = 'Very Strong';
    else if (strength >= 5) label = 'Strong';
    else if (strength >= 4) label = 'Good';
    else if (strength >= 3) label = 'Fair';
    else if (strength >= 2) label = 'Weak';
    
    return { strength, label };
  }, [newPassword]);

  // Enhanced update function with comprehensive validation
  const handleUpdatePassword = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the form errors before submitting.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Re-authenticate with current password to ensure security
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect. Please try again.");
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (updateError) {
        throw new Error(updateError.message || "Failed to update password. Please try again.");
      }

      Alert.alert("Success", "Your password has been updated successfully!", [
        { text: "OK", onPress: () => {
          // Clear all password fields for security
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          router.back();
        }}
      ]);
    } catch (error: any) {
      console.error("Error updating password:", error);
      const errorMessage = error.message || "An error occurred while updating your password.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/login") }
        ]);
      } else if (errorMessage.includes("incorrect")) {
        Alert.alert("Authentication Failed", errorMessage);
        setCurrentPassword(""); // Clear incorrect password
      } else {
        Alert.alert("Update Error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [validateForm, email, currentPassword, newPassword, router]);

  // Enhanced loading state
  if (fetchingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Fetching user information...</Text>
      </View>
    );
  }

  const passwordStrength = getPasswordStrength();

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

      <Text style={[styles.title, { color: theme.text }]}>Change Password</Text>
      
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        For your security, please enter your current password to confirm your identity.
      </Text>

      {/* Current Password Section */}
      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Current Password *</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.currentPassword ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.card
            }
          ]}
          placeholder="Enter your current password"
          placeholderTextColor={theme.placeholder}
          secureTextEntry
          value={currentPassword}
          onChangeText={handleCurrentPasswordChange}
          autoCapitalize="none"
          editable={!loading}
        />
        {validationErrors.currentPassword && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.currentPassword}</Text>
        )}
      </View>

      {/* New Password Section */}
      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>New Password *</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.newPassword ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.card
            }
          ]}
          placeholder="Enter your new password"
          placeholderTextColor={theme.placeholder}
          secureTextEntry
          value={newPassword}
          onChangeText={handleNewPasswordChange}
          autoCapitalize="none"
          editable={!loading}
        />
        {validationErrors.newPassword && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.newPassword}</Text>
        )}
        
        {/* Password Strength Indicator */}
        {newPassword && !validationErrors.newPassword && (
          <View style={styles.strengthContainer}>
            <Text style={[styles.strengthLabel, { color: theme.subtext }]}>Password Strength: </Text>
            <View style={styles.strengthBarContainer}>
              <View style={[
                styles.strengthBar,
                { backgroundColor: theme.border }
              ]}>
                <View style={[
                  styles.strengthFill,
                  { 
                    width: `${(passwordStrength.strength / 6) * 100}%`,
                    backgroundColor: passwordStrength.strength >= 4 ? '#4CAF50' : 
                                   passwordStrength.strength >= 3 ? '#FF9800' : '#F44336'
                  }
                ]} />
              </View>
              <Text style={[
                styles.strengthText, 
                { 
                  color: passwordStrength.strength >= 4 ? '#4CAF50' : 
                         passwordStrength.strength >= 3 ? '#FF9800' : '#F44336'
                }
              ]}>
                {passwordStrength.label}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Confirm Password Section */}
      <View style={styles.formSection}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Confirm New Password *</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.confirmPassword ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.card
            }
          ]}
          placeholder="Confirm your new password"
          placeholderTextColor={theme.placeholder}
          secureTextEntry
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          autoCapitalize="none"
          editable={!loading}
        />
        {validationErrors.confirmPassword && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.confirmPassword}</Text>
        )}
      </View>

      {/* Password Requirements */}
      <View style={styles.requirementsContainer}>
        <Text style={[styles.requirementsTitle, { color: theme.text }]}>Password Requirements:</Text>
        <Text style={[styles.requirementText, { color: theme.subtext }]}>• At least 6 characters long</Text>
        <Text style={[styles.requirementText, { color: theme.subtext }]}>• Different from your current password</Text>
        <Text style={[styles.requirementText, { color: theme.subtext }]}>• Recommended: Mix of letters, numbers, and symbols</Text>
      </View>

      {/* Button Container */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button, 
            { 
              backgroundColor: isFormValid() && !loading ? theme.primary : theme.border,
              opacity: loading ? 0.6 : 1
            }
          ]}
          onPress={handleUpdatePassword}
          disabled={!isFormValid() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Update Password</Text>
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryBanner: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  strengthContainer: {
    marginTop: 12,
  },
  strengthLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  strengthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 60,
  },
  requirementsContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 12,
    marginBottom: 32,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default EditPassword;
