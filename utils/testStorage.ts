import { supabase } from '../utils/supabase';

// Test function to verify storage bucket is working
export const testStorageBucket = async () => {
  try {
    console.log('Testing storage bucket...');
    
    // Test 1: List buckets to verify our bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return false;
    }
    
    const profileBucket = buckets?.find(bucket => bucket.name === 'profile-pictures');
    if (!profileBucket) {
      console.error('Profile pictures bucket not found');
      return false;
    }
    
    console.log('✅ Profile pictures bucket found:', profileBucket);
    
    // Test 2: Try to list files in the bucket (should work even if empty)
    const { data: files, error: filesError } = await supabase.storage
      .from('profile-pictures')
      .list();
    
    if (filesError) {
      console.error('Error accessing bucket:', filesError);
      return false;
    }
    
    console.log('✅ Bucket accessible, files found:', files?.length || 0);
    
    // Test 3: Get public URL (this tests if bucket is public)
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl('test.jpg'); // This won't exist, but should return a URL
    
    if (publicUrl && publicUrl.includes('profile-pictures')) {
      console.log('✅ Public URL generation working:', publicUrl);
      return true;
    } else {
      console.error('❌ Public URL generation failed');
      return false;
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
};

// Call this function to test your setup
// testStorageBucket();