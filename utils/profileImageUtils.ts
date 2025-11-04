import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

export const uploadProfileImage = async (userId: string, imageUri: string): Promise<string | null> => {
  try {
    // Check authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      throw new Error('User not authenticated');
    }

    // Create a unique filename with user folder structure for RLS
    const fileName = `${userId}/profile-${Date.now()}.jpg`;
    
    // Read the file as base64 using legacy API
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    
    // Convert base64 to ArrayBuffer
    const arrayBuffer = decode(base64);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    // Update user profile with new URL
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ profile_picture_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadProfileImage:', error);
    return null;
  }
};



export const getProfileImageUrl = async (userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('profile_picture_url')
      .eq('id', userId)
      .single();

    if (error || !data?.profile_picture_url) {
      return null;
    }

    return data.profile_picture_url;
  } catch (error) {
    console.error('Error getting profile image URL:', error);
    return null;
  }
};

export const deleteProfileImage = async (userId: string): Promise<boolean> => {
  try {
    // Get current image URL to extract filename
    const currentUrl = await getProfileImageUrl(userId);
    if (!currentUrl) return true;

    // Extract filename from URL
    const fileName = currentUrl.split('/').pop();
    if (!fileName) return false;

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('profile-pictures')
      .remove([fileName]);

    if (deleteError) {
      console.error('Error deleting image from storage:', deleteError);
    }

    // Clear URL from database
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ profile_picture_url: null })
      .eq('id', userId);

    return !updateError;
  } catch (error) {
    console.error('Error in deleteProfileImage:', error);
    return false;
  }
};