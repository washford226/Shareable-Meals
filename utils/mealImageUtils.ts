import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

export const uploadMealImage = async (userId: string, mealId: string, imageUri: string): Promise<string | null> => {
  try {
    // Check authentication status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      throw new Error('User not authenticated');
    }

    // Create a unique filename with user/meal folder structure
    const fileName = `${userId}/${mealId}/meal-${Date.now()}.jpg`;
    
    // Read the file as base64 using legacy API
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    
    // Convert base64 to ArrayBuffer
    const arrayBuffer = decode(base64);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('meal-images')
      .upload(fileName, arrayBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('Error uploading meal image:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('meal-images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadMealImage:', error);
    return null;
  }
};

export const uploadMultipleMealImages = async (userId: string, mealId: string, imageUris: string[]): Promise<string[]> => {
  try {
    const uploadPromises = imageUris.map(uri => uploadMealImage(userId, mealId, uri));
    const results = await Promise.all(uploadPromises);
    
    // Filter out null results
    return results.filter(url => url !== null) as string[];
  } catch (error) {
    console.error('Error uploading multiple meal images:', error);
    return [];
  }
};

export const deleteMealImage = async (imageUrl: string): Promise<boolean> => {
  try {
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts.slice(-3).join('/'); // Get userId/mealId/filename.jpg
    
    if (!fileName) {
      console.error('Could not extract filename from URL:', imageUrl);
      return false;
    }

    // Delete from storage
    const { error } = await supabase.storage
      .from('meal-images')
      .remove([fileName]);

    if (error) {
      console.error('Error deleting meal image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteMealImage:', error);
    return false;
  }
};

export const deleteMealImages = async (imageUrls: string[]): Promise<boolean> => {
  try {
    const deletePromises = imageUrls.map(url => deleteMealImage(url));
    const results = await Promise.all(deletePromises);
    
    // Return true if all deletions succeeded
    return results.every(result => result === true);
  } catch (error) {
    console.error('Error deleting multiple meal images:', error);
    return false;
  }
};

export const getMealImagesForUser = async (userId: string, mealId?: string): Promise<string[]> => {
  try {
    const folderPath = mealId ? `${userId}/${mealId}` : userId;
    
    const { data: files, error } = await supabase.storage
      .from('meal-images')
      .list(folderPath);

    if (error) {
      console.error('Error listing meal images:', error);
      return [];
    }

    if (!files) return [];

    // Get public URLs for all images
    const imageUrls = files
      .filter(file => file.name.endsWith('.jpg') || file.name.endsWith('.png') || file.name.endsWith('.webp') || file.name.endsWith('.gif'))
      .map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from('meal-images')
          .getPublicUrl(`${folderPath}/${file.name}`);
        return publicUrl;
      });

    return imageUrls;
  } catch (error) {
    console.error('Error in getMealImagesForUser:', error);
    return [];
  }
};