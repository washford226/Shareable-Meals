import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../utils/supabase";
import { useTheme } from "../../context/ThemeContext";

const ForgotPasswordScreen = () => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Success',
          'Password reset instructions have been sent to your email.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
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
          <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name="lock-closed" size={48} color={theme.buttonTextPrimary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Enter your email address and we'll send you instructions to reset your password
          </Text>
        </View>

        {/* Reset Card */}
        <View style={[styles.resetCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="mail" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Email Address
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

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: theme.primary }]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonTextPrimary} />
            ) : (
              <Text style={[styles.resetButtonText, { color: theme.buttonTextPrimary }]}>
                Send Reset Instructions
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to Login Card */}
        <View style={[styles.loginCard, { backgroundColor: theme.card }]}>
          <View style={styles.loginContent}>
            <Text style={[styles.loginText, { color: theme.text }]}>
              Remember your password?
            </Text>
            <TouchableOpacity
              style={[styles.loginButton, { borderColor: theme.primary }]}
              onPress={() => router.replace("/login")}
              disabled={loading}
            >
              <Text style={[styles.loginButtonText, { color: theme.primary }]}>
                Back to Sign In
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
  headerSection: {
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
  resetCard: {
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
  resetButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loginCard: {
    borderRadius: 16,
    padding: 24,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loginContent: {
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    marginBottom: 16,
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;