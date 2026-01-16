import React from 'react';
import { Hash, TrendingUp } from 'lucide-react';

interface HashtagDisplayProps {
  content: string;
  onHashtagClick?: (hashtag: string) => void;
  className?: string;
}

export const HashtagDisplay: React.FC<HashtagDisplayProps> = ({ 
  content, 
  onHashtagClick, 
  className = '' 
}) => {
  // Extract hashtags from content
  const hashtagRegex = /#[\w\u0600-\u06FF]+/g;
  const hashtags = content.match(hashtagRegex) || [];
  
  // Replace hashtags in content with clickable elements
  const renderContentWithHashtags = () => {
    if (hashtags.length === 0) {
      return content;
    }

    const parts = content.split(hashtagRegex);
    const result: (string | JSX.Element)[] = [];
    
    let hashtagIndex = 0;
    parts.forEach((part, index) => {
      result.push(part);
      
      if (hashtagIndex < hashtags.length) {
        const hashtag = hashtags[hashtagIndex];
        result.push(
          <button
            key={`hashtag-${index}-${hashtagIndex}`}
            onClick={() => onHashtagClick?.(hashtag)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
          >
            {hashtag}
          </button>
        );
        hashtagIndex++;
      }
    });
    
    return result;
  };

  return (
    <div className={className}>
      {renderContentWithHashtags()}
    </div>
  );
};

interface TrendingHashtagsProps {
  hashtags: Array<{ hashtag: string; postCount: number }>;
  onHashtagClick?: (hashtag: string) => void;
  className?: string;
}

export const TrendingHashtags: React.FC<TrendingHashtagsProps> = ({
  hashtags,
  onHashtagClick,
  className = ''
}) => {
  if (hashtags.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center mb-3">
        <TrendingUp className="w-5 h-5 text-orange-500 mr-2" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Trending Hashtags</h3>
      </div>
      
      <div className="space-y-2">
        {hashtags.map((item, index) => (
          <button
            key={index}
            onClick={() => onHashtagClick?.(item.hashtag)}
            className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="flex items-center">
              <Hash className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {item.hashtag.replace('#', '')}
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {item.postCount} posts
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface HashtagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const HashtagInput: React.FC<HashtagInputProps> = ({
  value,
  onChange,
  placeholder = "Add hashtags...",
  className = ''
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Auto-add # for hashtags
    const words = inputValue.split(' ');
    const processedWords = words.map(word => {
      if (word.length > 0 && !word.startsWith('#') && /^[a-zA-Z0-9\u0600-\u06FF]/.test(word)) {
        // Check if this looks like a hashtag (no spaces, alphanumeric)
        if (word.length > 1 && !/\s/.test(word)) {
          return `#${word}`;
        }
      }
      return word;
    });
    
    onChange(processedWords.join(' '));
  };

  const extractHashtags = () => {
    const hashtagRegex = /#[\w\u0600-\u06FF]+/g;
    return value.match(hashtagRegex) || [];
  };

  const hashtags = extractHashtags();

  return (
    <div className={className}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      
      {hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {hashtags.map((hashtag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              <Hash className="w-3 h-3 mr-1" />
              {hashtag.replace('#', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};