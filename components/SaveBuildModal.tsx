import React, { useState, useEffect } from 'react';
import { X, Save, Tag } from 'lucide-react';

interface SaveBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (buildName: string, saveAsNew?: boolean, tags?: string[], notes?: string) => void;
  defaultName?: string;
  isEditMode?: boolean;
  existingTags?: string[];
  existingNotes?: string;
}

const AVAILABLE_TAGS = ['Gaming', 'Workstation', 'Budget', 'High-End', 'Streaming', 'Content Creation'];

export default function SaveBuildModal({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultName = '', 
  isEditMode = false,
  existingTags = [],
  existingNotes = ''
}: SaveBuildModalProps) {
  const [buildName, setBuildName] = useState(defaultName);
  const [selectedTags, setSelectedTags] = useState<string[]>(existingTags);
  const [notes, setNotes] = useState(existingNotes);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBuildName(defaultName);
      setSelectedTags(existingTags);
      setNotes(existingNotes);
      setError('');
    }
  }, [isOpen, defaultName, existingTags, existingNotes]);

  const handleSave = (saveAsNew: boolean = false) => {
    const trimmedName = buildName.trim();
    
    if (!trimmedName) {
      setError('Please enter a build name');
      return;
    }
    
    if (trimmedName.length < 3) {
      setError('Build name must be at least 3 characters');
      return;
    }
    
    if (trimmedName.length > 50) {
      setError('Build name must be less than 50 characters');
      return;
    }
    
    onSave(trimmedName, saveAsNew, selectedTags, notes.trim());
    setBuildName('');
    setSelectedTags([]);
    setNotes('');
    setError('');
  };

  const handleClose = () => {
    setBuildName('');
    setSelectedTags([]);
    setNotes('');
    setError('');
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave(false);
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Save className="w-5 h-5" />
            {isEditMode ? 'Update Build' : 'Save Your Build'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Build Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Build Name *
            </label>
            <input
              type="text"
              value={buildName}
              onChange={(e) => {
                setBuildName(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyPress}
              placeholder="e.g., Gaming Build, Dream PC, Budget Setup"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500"
              autoFocus
            />
            
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* Category Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              Category Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Select one or more tags to categorize your build
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this build... (e.g., future upgrades, purpose, etc.)"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {notes.length}/200 characters
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                     transition-colors"
          >
            Cancel
          </button>
          
          {isEditMode ? (
            <>
              <button
                onClick={() => handleSave(true)}
                className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 
                         dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20
                         transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Save className="w-4 h-4" />
                Save As New
              </button>
              <button
                onClick={() => handleSave(false)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                         transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Save className="w-4 h-4" />
                Update
              </button>
            </>
          ) : (
            <button
              onClick={() => handleSave(false)}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Save className="w-4 h-4" />
              Save Build
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
