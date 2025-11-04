import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

export const testStorageAccess = async () => {
  console.log('=== Testing Storage Access ===');
  
  try {
    // Test 1: Check authentication
    console.log('1. Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    if (!user) {
      console.error('❌ No user found');
      return;
    }
    console.log('✅ User authenticated:', user.id);
    
    // Test 2: Test bucket access
    console.log('2. Testing bucket access...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('❌ Bucket list error:', bucketError);
      return;
    }
    console.log('✅ Available buckets:', buckets?.map(b => b.name));
    
    // Test 3: Test file listing in profile-pictures bucket
    console.log('3. Testing file listing...');
    const { data: files, error: listError } = await supabase.storage
      .from('profile-pictures')
      .list();
    if (listError) {
      console.error('❌ File list error:', listError);
      return;
    }
    console.log('✅ Files in bucket:', files?.length || 0);
    
    // Test 4: Test simple upload with image type
    console.log('4. Testing simple image upload...');
    const testFileName = `${user.id}/test-${Date.now()}.jpg`;
    // Create a simple 1x1 pixel JPEG in base64
    const simpleJpeg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
    const testData = decode(simpleJpeg);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(testFileName, testData, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return;
    }
    console.log('✅ Test upload successful:', uploadData);
    
    // Test 5: Clean up test file
    console.log('5. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('profile-pictures')
      .remove([testFileName]);
      
    if (deleteError) {
      console.error('⚠️ Delete error (non-critical):', deleteError);
    } else {
      console.log('✅ Test file cleaned up');
    }
    
    console.log('=== Storage test completed successfully! ===');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};