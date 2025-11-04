# Meal Images Storage System

## Setup Instructions

### 1. Run SQL Setup
Execute the SQL script in your Supabase SQL Editor:
```sql
-- Copy and paste the content from meal_images_storage_setup.sql
```

This will create:
- `meal-images` bucket with 10MB file size limit
- RLS policies allowing authenticated users to upload/manage images
- Public access for viewing meal images

### 2. Import Utils
```typescript
import { 
  uploadMealImage, 
  uploadMultipleMealImages, 
  deleteMealImage, 
  deleteMealImages,
  getMealImagesForUser 
} from '../../../utils/mealImageUtils';
```

## Usage Examples

### Single Image Upload
```typescript
const handleImageUpload = async (mealId: string, imageUri: string) => {
  const imageUrl = await uploadMealImage(userData.id, mealId, imageUri);
  if (imageUrl) {
    // Update meal record with new image URL
    // Save to meal.image_url or meal.images array
  }
};
```

### Multiple Images Upload
```typescript
const handleMultipleUpload = async (mealId: string, imageUris: string[]) => {
  const imageUrls = await uploadMultipleMealImages(userData.id, mealId, imageUris);
  // Save imageUrls array to meal.images
};
```

### Get User's Meal Images
```typescript
// Get all images for a user
const allImages = await getMealImagesForUser(userData.id);

// Get images for specific meal
const mealImages = await getMealImagesForUser(userData.id, mealId);
```

### Delete Images
```typescript
// Delete single image
await deleteMealImage(imageUrl);

// Delete multiple images
await deleteMealImages([url1, url2, url3]);
```

## File Organization

Images are stored in this structure:
```
meal-images/
├── userId1/
│   ├── mealId1/
│   │   ├── meal-1640995200000.jpg
│   │   └── meal-1640995300000.jpg
│   └── mealId2/
│       └── meal-1640995400000.jpg
└── userId2/
    └── mealId3/
        └── meal-1640995500000.jpg
```

## Features

✅ **User-specific folders**: Each user's images are organized by user ID  
✅ **Meal-specific subfolders**: Images grouped by meal ID  
✅ **Multiple image support**: Upload arrays of images  
✅ **Automatic cleanup**: Delete functions for removing images  
✅ **Public viewing**: Anyone can view meal images (good for sharing)  
✅ **Large file support**: 10MB limit (vs 5MB for profile pics)  
✅ **Multiple formats**: JPEG, PNG, WebP, GIF support

## Security

- Only authenticated users can upload/modify images
- Users can access any meal images (public viewing)
- RLS policies prevent unauthorized uploads
- Folder structure organizes images by user