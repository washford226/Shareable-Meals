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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Change Password
          </Text>
          <View style={styles.headerActions} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading security settings...
          </Text>
        </View>
      </View>
    );
  }

  const passwordStrength = getPasswordStrength();

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
          Change Password
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
        {/* Security Info Card */}
        <View style={[styles.securityCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Password Security
            </Text>
          </View>
          <Text style={[styles.securityDescription, { color: theme.subtext }]}>
            For your security, please enter your current password to confirm your identity before setting a new password.
          </Text>
        </View>

        {/* Current Password Card */}
        <View style={[styles.passwordCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Current Password
            </Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.passwordInput, 
                { 
                  borderColor: validationErrors.currentPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background
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
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.currentPassword}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* New Password Card */}
        <View style={[styles.passwordCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="key" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              New Password
            </Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.passwordInput, 
                { 
                  borderColor: validationErrors.newPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background
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
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.newPassword}
                </Text>
              </View>
            )}
            
            {/* Password Strength Indicator */}
            {newPassword && !validationErrors.newPassword && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthHeader}>
                  <Text style={[styles.strengthLabel, { color: theme.subtext }]}>
                    Password Strength
                  </Text>
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
                <View style={[styles.strengthBar, { backgroundColor: theme.border }]}>
                  <View style={[
                    styles.strengthFill,
                    { 
                      width: `${(passwordStrength.strength / 6) * 100}%`,
                      backgroundColor: passwordStrength.strength >= 4 ? '#4CAF50' : 
                                     passwordStrength.strength >= 3 ? '#FF9800' : '#F44336'
                    }
                  ]} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Confirm Password Card */}
        <View style={[styles.passwordCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Confirm New Password
            </Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.passwordInput, 
                { 
                  borderColor: validationErrors.confirmPassword ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background
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
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.confirmPassword}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Password Requirements Card */}
        <View style={[styles.requirementsCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Password Requirements
            </Text>
          </View>
          <View style={styles.requirementsList}>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={newPassword.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={newPassword.length >= 6 ? '#4CAF50' : theme.subtext} 
              />
              <Text style={[styles.requirementText, { 
                color: newPassword.length >= 6 ? '#4CAF50' : theme.subtext 
              }]}>
                At least 6 characters long
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={currentPassword && newPassword && currentPassword !== newPassword ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={currentPassword && newPassword && currentPassword !== newPassword ? '#4CAF50' : theme.subtext} 
              />
              <Text style={[styles.requirementText, { 
                color: currentPassword && newPassword && currentPassword !== newPassword ? '#4CAF50' : theme.subtext 
              }]}>
                Different from your current password
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(newPassword) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(newPassword) ? '#4CAF50' : theme.subtext} 
              />
              <Text style={[styles.requirementText, { 
                color: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(newPassword) ? '#4CAF50' : theme.subtext 
              }]}>
                Mix of uppercase, lowercase, and numbers (recommended)
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.updateButton, 
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
              <>
                <Ionicons name="save" size={16} color={theme.buttonText} />
                <Text style={[styles.updateButtonText, { color: theme.buttonText }]}>
                  Update Password
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
    paddingVertical: 12,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 40,
    height: 40,
  },

  // Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Content Styles
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // Card Styles
  securityCard: {
    backgroundColor: 'white',
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
        elevation: 4,
      },
    }),
  },
  passwordCard: {
    backgroundColor: 'white',
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
        elevation: 4,
      },
    }),
  },
  requirementsCard: {
    backgroundColor: 'white',
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
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Input Styles
  inputContainer: {
    marginTop: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },

  // Password Strength Styles
  strengthContainer: {
    marginTop: 12,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  strengthBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Requirements Styles
  requirementsList: {
    gap: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },

  // Button Styles
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },

  // Legacy styles (keeping for compatibility)
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
  strengthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
});

export default EditPassword;
