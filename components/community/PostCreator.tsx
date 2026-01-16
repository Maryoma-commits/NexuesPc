// PostCreator Component for NexusPC Community Posts
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
import React, { useState, useRef, useCallback } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Tag, 
  Globe, 
  Users, 
  Lock, 
  Loader2, 
  Search,
  Plus,
  Trash2,
  ChevronDown,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { postService } from '../../services/postService';
import { uploadChatImage } from '../../services/chatService';
import { loadProductsFromFile } from '../../services/dataService';
import { 
  PostPrivacy, 
  ProductReference, 
  CreatePostRequest,
  Post,
  PostError,
  PostErrorType
} from '../../types/community-posts';
import { Product } from '../../types';
import { HashtagInput } from './HashtagDisplay';
import PrivacySettingsModal from './PrivacySettingsModal';

// Constants for validation
export const MAX_CONTENT_LENGTH = 5000;
export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

interface PostCreatorProps {
  onPostCreated: (post: Post) => void;
  onCancel?: () => void;
  initialContent?: string;
  taggedProducts?: ProductReference[];
  editMode?: boolean;
  editPostId?: string;
  existingImages?: string[];
}

interface ImagePreview {
  file: File;
  preview: string;
  uploading: boolean;
  error?: string;
}

// Privacy option configuration
const PRIVACY_OPTIONS: { value: PostPrivacy; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'public', label: 'Public', icon: <Globe size={16} />, description: 'Anyone can see this post' },
  { value: 'friends', label: 'Friends', icon: <Users size={16} />, description: 'Only friends can see this post' },
  { value: 'private', label: 'Only Me', icon: <Lock size={16} />, description: 'Only you can see this post' }
];

export default function PostCreator({ 
  onPostCreated, 
  onCancel,
  initialContent = '', 
  taggedProducts: initialTaggedProducts = [],
  editMode = false,
  editPostId,
  existingImages = []
}: PostCreatorProps) {
  const { userProfile } = useAuth();
  
  // Form state
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [taggedProducts, setTaggedProducts] = useState<ProductReference[]>(initialTaggedProducts);
  const [privacy, setPrivacy] = useState<PostPrivacy>('public');
  const [keptExistingImages, setKeptExistingImages] = useState<string[]>(existingImages);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Character count and validation
  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CONTENT_LENGTH;
  const remainingChars = MAX_CONTENT_LENGTH - characterCount;
  const totalImages = images.length + keptExistingImages.length;

  // Validation helper
  const validateForm = (): string | null => {
    if (!content.trim()) {
      return 'Please write something to share';
    }
    if (isOverLimit) {
      return `Content exceeds ${MAX_CONTENT_LENGTH} character limit`;
    }
    if (images.some(img => img.uploading)) {
      return 'Please wait for images to finish uploading';
    }
    if (images.some(img => img.error)) {
      return 'Please remove failed image uploads';
    }
    return null;
  };

  // Handle content change with auto-resize
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // File validation
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, and WebP images are allowed';
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return `Image must be less than ${MAX_IMAGE_SIZE_MB}MB`;
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesToAdd = Array.from(files);
    
    for (const file of filesToAdd) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview: ImagePreview = {
          file,
          preview: event.target?.result as string,
          uploading: false
        };
        setImages(prev => [...prev, preview]);
      };
      reader.readAsDataURL(file);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [images.length]);

  // Product search
  const handleProductSearch = async (query: string) => {
    setProductSearchQuery(query);
    
    if (query.trim().length < 2) {
      setProductSearchResults([]);
      return;
    }

    setIsSearchingProducts(true);
    try {
      const allProducts = await loadProductsFromFile();
      const searchLower = query.toLowerCase();
      const results = allProducts
        .filter(p => 
          p.title.toLowerCase().includes(searchLower) ||
          p.category?.toLowerCase().includes(searchLower) ||
          p.retailer.toLowerCase().includes(searchLower)
        )
        .slice(0, 10); // Limit to 10 results
      setProductSearchResults(results);
    } catch (error) {
      toast.error('Failed to search products');
    } finally {
      setIsSearchingProducts(false);
    }
  };

  // Add product tag
  const handleAddProduct = (product: Product) => {
    // Check if already tagged
    if (taggedProducts.some(p => p.productId === product.id)) {
      toast.error('Product already tagged');
      return;
    }

    const productRef: ProductReference = {
      productId: product.id,
      title: product.title,
      imageUrl: product.imageUrl || '',
      price: product.price,
      retailer: product.retailer,
      category: product.category || 'Other'
    };

    setTaggedProducts(prev => [...prev, productRef]);
    setProductSearchQuery('');
    setProductSearchResults([]);
    setShowProductSearch(false);
    toast.success('Product tagged');
  };

  // Remove product tag
  const handleRemoveProduct = (productId: string) => {
    setTaggedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  // Submit post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!userProfile) {
      toast.error('Please sign in to create a post');
      return;
    }

    setIsSubmitting(true);

    try {
      // Mark all images as uploading
      setImages(prev => prev.map(item => ({ ...item, uploading: true })));

      // Upload all images in parallel
      const uploadPromises = images.map(async (img, index) => {
        try {
          const url = await uploadChatImage(img.file, 'post');
          setImages(prev => prev.map((item, idx) => 
            idx === index ? { ...item, uploading: false } : item
          ));
          return { index, url, error: null };
        } catch (error: any) {
          setImages(prev => prev.map((item, idx) => 
            idx === index ? { ...item, uploading: false, error: error.message } : item
          ));
          return { index, url: null, error: error.message };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Check for any failed uploads
      const failedUploads = results.filter(r => r.error);
      if (failedUploads.length > 0) {
        throw new Error(`Failed to upload ${failedUploads.length} image(s)`);
      }

      // Get successful URLs in order
      const uploadedImageUrls = results
        .sort((a, b) => a.index - b.index)
        .map(r => r.url!)
        .filter(Boolean);

      // Combine kept existing images with newly uploaded ones
      const allImageUrls = [...keptExistingImages, ...uploadedImageUrls];

      if (editMode && editPostId) {
        // Update existing post
        await postService.updatePost(editPostId, {
          content: content.trim(),
          images: allImageUrls,
          taggedProducts,
          privacy
        }, userProfile.uid);

        // Return updated post object
        const updatedPost: Post = {
          id: editPostId,
          authorId: userProfile.uid,
          content: content.trim(),
          images: allImageUrls,
          taggedProducts,
          privacy,
          createdAt: Date.now(),
          editedAt: Date.now(),
          likeCount: 0,
          commentCount: 0,
          reactionCounts: {}
        };

        toast.success('Post updated successfully!');
        onPostCreated(updatedPost);
      } else {
        // Create post request with pre-uploaded image URLs
        const postRequest: CreatePostRequest = {
          content: content.trim(),
          images: [], // Empty - we use imageUrls instead
          imageUrls: allImageUrls,
          taggedProducts,
          privacy
        };

        // Create the post
        const post = await postService.createPost(postRequest, userProfile.uid);

        toast.success('Post created successfully!');
        onPostCreated(post);
      }
      
      // Reset form
      setContent('');
      setImages([]);
      setTaggedProducts([]);
      setPrivacy('public');
      setKeptExistingImages([]);
      
    } catch (error: any) {
      if (error instanceof PostError) {
        toast.error(error.message);
      } else {
        toast.error(error.message || 'Failed to create post');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format price for display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'currency',
      currency: 'IQD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const selectedPrivacy = PRIVACY_OPTIONS.find(opt => opt.value === privacy)!;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editMode ? 'Edit Post' : 'Create Post'}
          </h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div 
          ref={dropZoneRef}
          className={`p-4 ${isDragging ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-500' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* User info */}
          <div className="flex items-center gap-3 mb-4">
            <img
              src={userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.displayName || 'User')}&background=random`}
              alt={userProfile?.displayName || 'User'}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {userProfile?.displayName || 'User'}
              </p>
              {/* Privacy selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrivacyDropdown(!showPrivacyDropdown)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {selectedPrivacy.icon}
                  <span>{selectedPrivacy.label}</span>
                  <ChevronDown size={14} />
                </button>
                
                {showPrivacyDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-10 min-w-[200px]">
                    {PRIVACY_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPrivacy(option.value);
                          setShowPrivacyDropdown(false);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                          privacy === option.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <span className="text-gray-600 dark:text-gray-300">{option.icon}</span>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPrivacyModal(true);
                          setShowPrivacyDropdown(false);
                        }}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-600 text-blue-600 dark:text-blue-400"
                      >
                        <Settings size={16} />
                        <span className="text-sm font-medium">Privacy Settings</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="What's on your mind? Share your PC build, product discovery, or tech experience..."
            className={`w-full min-h-[120px] resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-lg ${
              isOverLimit ? 'text-red-500' : ''
            }`}
            disabled={isSubmitting}
          />

          {/* Character count */}
          <div className={`text-right text-sm ${
            isOverLimit ? 'text-red-500' : remainingChars < 500 ? 'text-yellow-500' : 'text-gray-400'
          }`}>
            {characterCount} / {MAX_CONTENT_LENGTH}
          </div>

          {/* Drag overlay */}
          {isDragging && (
            <div className="mt-4 p-8 border-2 border-dashed border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
              <ImageIcon size={48} className="mx-auto text-blue-500 mb-2" />
              <p className="text-blue-600 dark:text-blue-400 font-medium">Drop images here</p>
            </div>
          )}

          {/* Existing images (edit mode) - with remove buttons */}
          {keptExistingImages.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Images</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {keptExistingImages.map((url, index) => (
                  <div key={`existing-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                    <img
                      src={url}
                      alt={`Existing ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setKeptExistingImages(prev => prev.filter((_, i) => i !== index))}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                      disabled={isSubmitting}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image previews - new images being added */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={img.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="animate-spin text-white" size={24} />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                      <p className="text-white text-xs text-center px-2">{img.error}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    disabled={isSubmitting}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              {/* Add more images button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                disabled={isSubmitting}
              >
                <Plus size={24} />
                <span className="text-xs mt-1">Add more</span>
              </button>
            </div>
          )}

          {/* Tagged products */}
          {taggedProducts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Tagged Products</p>
              <div className="flex flex-wrap gap-2">
                {taggedProducts.map(product => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"
                  >
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-8 h-8 object-contain rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {product.title}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(product.productId)}
                      className="text-gray-400 hover:text-red-500"
                      disabled={isSubmitting}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product search */}
          {showProductSearch && (
            <div className="mt-4 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => handleProductSearch(e.target.value)}
                  placeholder="Search products to tag..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              
              {isSearchingProducts && (
                <div className="mt-3 flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              )}
              
              {productSearchResults.length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                  {productSearchResults.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <img
                        src={product.imageUrl || '/placeholder.jpg'}
                        alt={product.title}
                        className="w-10 h-10 object-contain rounded bg-white"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.retailer} • {formatPrice(product.price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {productSearchQuery.length >= 2 && !isSearchingProducts && productSearchResults.length === 0 && (
                <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  No products found
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Image upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-green-600 dark:text-green-400"
                disabled={isSubmitting}
                title="Add photos"
              >
                <ImageIcon size={24} />
              </button>
              
              {/* Product tag button */}
              <button
                type="button"
                onClick={() => setShowProductSearch(!showProductSearch)}
                className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  showProductSearch ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-orange-600 dark:text-orange-400'
                }`}
                disabled={isSubmitting}
                title="Tag products"
              >
                <Tag size={24} />
              </button>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !content.trim() || isOverLimit}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isSubmitting || !content.trim() || isOverLimit
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  Posting...
                </span>
              ) : (
                'Post'
              )}
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </form>

      {/* Privacy Settings Modal */}
      <PrivacySettingsModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onPrivacyChange={(newPrivacy) => setPrivacy(newPrivacy)}
        currentPrivacy={privacy}
      />
    </div>
  );
}
