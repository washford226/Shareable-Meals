import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "context/ThemeContext";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "" });
  const router = useRouter();
  const { theme } = useTheme();

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Clear errors when user types
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (errors.email) {
      setErrors({ email: "" });
    }
  };

  const handleForgotPassword = async () => {
    // Reset errors
    setErrors({ email: "" });
    
    // Validation
    if (!email.trim()) {
      setErrors({ email: "Email address is required" });
      return;
    }
    
    if (!validateEmail(email.trim())) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: "https://shareablemeals.com/reset-password",
      });

      if (error) {
        if (error.message.toLowerCase().includes("user not found")) {
          Alert.alert(
            "Email Not Found", 
            "No account found with this email address. Please check your email or create a new account.",
            [{ text: "OK" }]
          );
        } else if (error.message.toLowerCase().includes("rate limit")) {
          Alert.alert(
            "Too Many Requests", 
            "Too many password reset attempts. Please wait a few minutes before trying again.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Error", 
            error.message || "Failed to send reset email. Please try again.",
            [{ text: "OK" }]
          );
        }
      } else {
        Alert.alert(
          "Reset Link Sent",
          "We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.",
          [
            { 
              text: "OK", 
              onPress: () => router.replace("../(auth)/login") 
            }
          ]
        );
      }
    } catch (error) {
      console.error("Error sending forgot password email:", error);
      Alert.alert(
        "Network Error", 
        "Unable to send reset email. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={[styles.iconContainer, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="lock-closed" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Don&apos;t worry! Enter your email address and we&apos;ll send you a link to reset your password.
          </Text>
        </View>

        {/* Reset Password Card */}
        <View style={[styles.resetCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="mail" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Reset Password
            </Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Email Address
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  borderColor: errors.email ? theme.danger : theme.border, 
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
            {errors.email && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errors.email}
                </Text>
              </View>
            )}
          </View>

          {/* Info Message */}
          <View style={[styles.infoContainer, { backgroundColor: `${theme.primary}10` }]}>
            <Ionicons name="information-circle" size={16} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.primary }]}>
              We&apos;ll send a secure link to reset your password. The link will expire in 24 hours for your security.
            </Text>
          </View>

          {/* Send Reset Link Button */}
          <TouchableOpacity
            style={[
              styles.resetButton, 
              { 
                backgroundColor: (!email || loading || errors.email) ? theme.border : theme.primary,
                opacity: loading ? 0.8 : 1
              }
            ]}
            onPress={handleForgotPassword}
            disabled={!email || loading || !!errors.email}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <>
                <Ionicons name="send" size={16} color={theme.buttonText} />
                <Text style={[styles.resetButtonText, { color: theme.buttonText }]}>
                  Send Reset Link
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Navigation Card */}
        <View style={[styles.navigationCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.navigationText, { color: theme.subtext }]}>
            Remember your password?
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { 
              borderColor: theme.border,
              backgroundColor: theme.background 
            }]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={16} color={theme.text} />
            <Text style={[styles.backButtonText, { color: theme.text }]}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={[styles.helpTitle, { color: theme.text }]}>
            Need Help?
          </Text>
          <Text style={[styles.helpText, { color: theme.subtext }]}>
            If you&apos;re having trouble receiving the reset email, check your spam folder or contact support for assistance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
  },
  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  // Reset Card
  resetCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  // Input Styles
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
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
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 16,
  },
  // Error and Info Styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  // Reset Button
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
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
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Navigation Card
  navigationCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  navigationText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Help Section
  helpSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ForgotPasswordScreen;
