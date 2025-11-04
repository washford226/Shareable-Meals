import { supabase } from '../utils/supabase';
import { uploadProfileImage, getProfileImageUrl } from '../utils/profileImageUtils';

// Complete test of the profile picture system
export const testCompleteProfilePictureFlow = async (userId: string) => {
  console.log('🧪 Testing complete profile picture flow...');
  
  try {
    // Test 1: Check current profile
    console.log('1️⃣ Checking current profile...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('username, profile_picture_url')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('❌ Profile check failed:', profileError);
      return false;
    }
    
    console.log('✅ Profile found:', profile);
    
    // Test 2: Test storage bucket access
    console.log('2️⃣ Testing storage bucket access...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Bucket access failed:', bucketError);
      return false;
    }
    
    const profileBucket = buckets?.find(bucket => bucket.name === 'profile-pictures');
    if (!profileBucket) {
      console.error('❌ Profile pictures bucket not found');
      return false;
    }
    
    console.log('✅ Storage bucket accessible');
    
    // Test 3: Test public URL generation
    console.log('3️⃣ Testing public URL generation...');
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl('test.jpg');
    
    if (!publicUrl.includes('profile-pictures')) {
      console.error('❌ Public URL generation failed');
      return false;
    }
    
    console.log('✅ Public URL generation working');
    
    // Test 4: Test profile picture URL retrieval
    console.log('4️⃣ Testing profile picture URL retrieval...');
    const currentUrl = await getProfileImageUrl(userId);
    console.log('✅ Current profile picture URL:', currentUrl || 'None');
    
    console.log('🎉 All tests passed! Profile picture system is ready.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
};

// Quick test function to call from the app
export const quickTest = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user found');
      return false;
    }
    
    return await testCompleteProfilePictureFlow(user.id);
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
};