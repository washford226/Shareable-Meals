/**
 * AI Usage Limit Setup Utility
 * 
 * This file contains utility functions to set up the AI usage limit feature
 * using Supabase JavaScript client instead of raw SQL.
 * 
 * Run these functions in your Supabase project or through a script to add
 * the required columns to your user_profiles table.
 */

import { supabase } from '../utils/supabase';

/**
 * Add the required columns for AI usage tracking
 * This is equivalent to the SQL migration but uses Supabase client
 */
export async function setupAIUsageColumns() {
  try {
    console.log('Setting up AI usage tracking columns...');
    
    // Note: Supabase JavaScript client doesn't support ALTER TABLE operations
    // You'll need to add these columns manually through the Supabase dashboard
    // or use the SQL migration file.
    
    console.log('Please add the following columns to your user_profiles table in Supabase dashboard:');
    console.log('');
    console.log('1. Column: ai_usage_count');
    console.log('   Type: int4 (integer)');
    console.log('   Default: 0');
    console.log('   Nullable: false');
    console.log('');
    console.log('2. Column: ai_usage_last_date');
    console.log('   Type: date');
    console.log('   Default: (none)');
    console.log('   Nullable: true');
    console.log('');
    console.log('Or run the SQL migration file: database_migrations/add_ai_usage_count.sql');
    
    return { success: true, message: 'Instructions provided' };
  } catch (error) {
    console.error('Error in setupAIUsageColumns:', error);
    return { success: false, error };
  }
}

/**
 * Reset AI usage count for a specific user (useful for testing)
 */
export async function resetUserAIUsage(userId: string) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        ai_usage_count: 0,
        ai_usage_last_date: null
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    console.log(`AI usage reset for user: ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error resetting user AI usage:', error);
    return { success: false, error };
  }
}

/**
 * Reset AI usage count for all users (useful for testing - use carefully!)
 */
export async function resetAllUsersAIUsage() {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        ai_usage_count: 0,
        ai_usage_last_date: null
      });

    if (error) {
      throw error;
    }

    console.log('AI usage reset for all users');
    return { success: true };
  } catch (error) {
    console.error('Error resetting all users AI usage:', error);
    return { success: false, error };
  }
}

/**
 * Get AI usage statistics for all users
 */
export async function getAIUsageStats() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, ai_usage_count, ai_usage_last_date')
      .order('ai_usage_count', { ascending: false });

    if (error) {
      throw error;
    }

    console.log('AI Usage Statistics:');
    console.table(data);
    return { success: true, data };
  } catch (error) {
    console.error('Error getting AI usage stats:', error);
    return { success: false, error };
  }
}

/**
 * Check if a user needs their daily usage reset
 */
export async function checkAndResetDailyUsage(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('ai_usage_count, ai_usage_last_date')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    const lastUsageDate = data.ai_usage_last_date;
    
    if (lastUsageDate !== today) {
      // Reset for new day
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          ai_usage_count: 0,
          ai_usage_last_date: today
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      return { 
        success: true, 
        reset: true, 
        message: 'Usage count reset for new day',
        currentCount: 0
      };
    }

    return { 
      success: true, 
      reset: false, 
      message: 'Same day, no reset needed',
      currentCount: data.ai_usage_count
    };
  } catch (error) {
    console.error('Error checking/resetting daily usage:', error);
    return { success: false, error };
  }
}

// Example usage:
// import { setupAIUsageColumns, resetUserAIUsage } from './path/to/this/file';
// 
// // Set up columns (shows instructions)
// setupAIUsageColumns();
// 
// // Reset usage for testing
// resetUserAIUsage('user-id-here');
