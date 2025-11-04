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
import { supabase } from "../../../utils/supabase";
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const EditEmailPassword = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState<string>("");
  const [originalEmail, setOriginalEmail] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

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
      setOriginalEmail(userData.user.email ?? "");
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      const errorMessage = error.message || "An error occurred while fetching user information.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/(auth)/login") }
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

  // Fetch the current email when the screen loads
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
  }, [email, currentPassword, newPassword, confirmPassword]);

  // Form field handlers with validation
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors(prev => ({ ...prev, email: '' }));
    }
  }, [validationErrors.email]);

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
    return email.trim() && Object.keys(validationErrors).length === 0;
  }, [email, validationErrors]);

  const hasChanges = useCallback(() => {
    return email !== originalEmail || newPassword.trim() !== "";
  }, [email, originalEmail, newPassword]);

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

      // Update email in Supabase Auth if it changed
      if (email !== originalEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ 
          email: email.trim() 
        });
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

      // Profile updated successfully
      console.log('User authentication details updated successfully');

      let successMessage = "Your account has been updated successfully!";
      if (email !== originalEmail) {
        successMessage += " Please check your new email inbox to confirm the email change.";
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
      console.error("Error updating account:", error);
      const errorMessage = error.message || "An error occurred while updating your account.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.replace("/(auth)/login") }
        ]);
      } else {
        Alert.alert("Update Error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [validateForm, hasChanges, email, originalEmail, newPassword, router]);

  // Enhanced loading state
  if (fetchingUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Email & Password</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading account information...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Email & Password</Text>
        <TouchableOpacity 
          onPress={handleUpdateProfile} 
          style={styles.saveButton}
          disabled={!isFormValid() || !hasChanges() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[
              styles.saveButtonText, 
              { 
                color: (isFormValid() && hasChanges() && !loading) ? theme.primary : theme.textSecondary 
              }
            ]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: theme.dangerLight, 
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
            <Text style={[styles.errorBannerButtonText, { color: 'white' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { 
          backgroundColor: theme.warningLight, 
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Email Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mail" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Email Address
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Email Address
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={16} color={theme.textSecondary} style={styles.inputIcon} />
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
              <View style={[styles.errorContainer, { backgroundColor: theme.dangerLight }]}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.email}
                </Text>
              </View>
            )}
            {email !== originalEmail && (
              <View style={[styles.infoContainer, { backgroundColor: theme.infoLight }]}>
                <Ionicons name="information-circle" size={14} color={theme.info} />
                <Text style={[styles.infoText, { color: theme.info }]}>
                  Email verification will be required for the new address
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Password Change Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Change Password
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            Leave blank if you don't want to change your password
          </Text>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Current Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key" size={16} color={theme.textSecondary} style={styles.inputIcon} />
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
              <View style={[styles.errorContainer, { backgroundColor: theme.dangerLight }]}>
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
              <Ionicons name="lock-open" size={16} color={theme.textSecondary} style={styles.inputIcon} />
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
              <View style={[styles.errorContainer, { backgroundColor: theme.dangerLight }]}>
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
              <Ionicons name="checkmark-circle" size={16} color={theme.textSecondary} style={styles.inputIcon} />
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
              <View style={[styles.errorContainer, { backgroundColor: theme.dangerLight }]}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {validationErrors.confirmPassword}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Security Notice */}
        <View style={[styles.securityNotice, { backgroundColor: theme.infoLight, borderColor: theme.info }]}>
          <Ionicons name="shield-checkmark" size={20} color={theme.info} />
          <View style={styles.securityNoticeText}>
            <Text style={[styles.securityNoticeTitle, { color: theme.info }]}>
              Security Notice
            </Text>
            <Text style={[styles.securityNoticeDescription, { color: theme.info }]}>
              Changing your email or password will require you to verify your identity. You may need to sign in again after these changes.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
    textAlign: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    marginTop: 12,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
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
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.medium,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.semiBold,
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
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.medium,
  },
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
  },
  sectionDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.medium,
    marginBottom: 8,
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
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  errorText: {
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
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
    fontSize: theme.fonts.small,
    fontFamily: theme.fontFamily.body,
    flex: 1,
    lineHeight: 16,
  },
  securityNotice: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  securityNoticeText: {
    flex: 1,
  },
  securityNoticeTitle: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4,
  },
  securityNoticeDescription: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default EditEmailPassword;