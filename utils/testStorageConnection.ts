// Simple test to verify storage is working
// Run this in the console to test your setup

import { supabase } from '../utils/supabase';

export const testStorageConnection = async () => {
  console.log('🧪 Testing storage connection...');
  
  try {
    // Test 1: List buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return false;
    }
    
    const profileBucket = buckets?.find(bucket => bucket.name === 'profile-pictures');
    if (!profileBucket) {
      console.error('❌ Profile pictures bucket not found');
      return false;
    }
    
    console.log('✅ Profile pictures bucket found');
    
    // Test 2: Test public URL generation
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl('test.jpg');
    
    if (!publicUrl.includes('profile-pictures')) {
      console.error('❌ Public URL generation failed');
      return false;
    }
    
    console.log('✅ Public URL generation working:', publicUrl);
    
    // Test 3: Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ No authenticated user');
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Test 4: Check profile table access
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('username, profile_picture_url')
      .eq('id', user.id)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Profile table access failed:', profileError);
      return false;
    }
    
    console.log('✅ Profile table accessible:', profile);
    
    console.log('🎉 All storage tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
};

// Call this function from the console to test
// testStorageConnection();