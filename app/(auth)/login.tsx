import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/supabase";
import { useTheme } from "../../context/ThemeContext";

const shareableMealsIcon = require('../../assets/images/ShareableMealsIcon.png');

const LoginScreen = () => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        // Check if the error is related to email confirmation
        if (error.message.includes('Email not confirmed') || 
            error.message.includes('email_not_confirmed') ||
            error.message.includes('not confirmed')) {
          handleUnverifiedEmail();
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        router.replace('/');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUnverifiedEmail = () => {
    Alert.alert(
      'Email Verification Required 📧',
      'Your account is not yet verified. Please check your email inbox and click the verification link. Didn\'t receive the email?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resend Verification',
          onPress: resendVerificationEmail
        }
      ]
    );
  };

  const resendVerificationEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      });

      if (error) {
        Alert.alert('Error', 'Failed to resend verification email. Please try again.');
      } else {
        Alert.alert(
          'Verification Email Sent! ✅',
          'We\'ve sent a new verification email to your inbox. Please check your email and click the verification link to activate your account.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
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
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.iconContainer}>
            <Image 
              source={shareableMealsIcon} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Welcome to Shareable Meals</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Sign in to start planning and sharing your meals
          </Text>
        </View>

        {/* Login Card */}
        <View style={[styles.loginCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="log-in" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Sign In
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
                  color: theme.text,
                  backgroundColor: theme.background 
                }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Password
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={16} color={theme.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { 
                  color: theme.text,
                  backgroundColor: theme.background,
                  paddingRight: 48
                }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.passwordToggle, { backgroundColor: theme.background }]}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={loading}
              >
                <Ionicons 
                  name={isPasswordVisible ? "eye-off" : "eye"} 
                  size={16} 
                  color={theme.subtext} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              disabled={loading}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonTextPrimary} />
            ) : (
              <Text style={[styles.loginButtonText, { color: theme.buttonTextPrimary }]}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Card */}
        <View style={[styles.signupCard, { backgroundColor: theme.card }]}>
          <View style={styles.signupContent}>
            <Text style={[styles.signupText, { color: theme.text }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity
              style={[styles.signupButton, { borderColor: theme.primary }]}
              onPress={() => router.push("/(auth)/signup")}
              disabled={loading}
            >
              <Text style={[styles.signupButtonText, { color: theme.primary }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
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
    padding: 20,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
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
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
    borderRadius: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signupCard: {
    borderRadius: 16,
    padding: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  signupContent: {
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    marginBottom: 16,
  },
  signupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;