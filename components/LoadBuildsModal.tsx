import React, { useState, useEffect, useMemo } from 'react';
import { X, FolderOpen, Trash2, Calendar, DollarSign, Grid3x3, List, ArrowUpDown, Cpu, Gpu, CircuitBoard, HardDrive, Zap, Fan, Box, MemoryStick } from 'lucide-react';
import { getSavedBuilds, deleteBuild, SavedBuild } from '../utils/buildStorage';

interface LoadBuildsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadBuild: (build: SavedBuild) => void;
}

export default function LoadBuildsModal({ isOpen, onClose, onLoadBuild }: LoadBuildsModalProps) {
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low'>('newest');

  useEffect(() => {
    if (isOpen) {
      loadBuilds();
    }
  }, [isOpen]);

  const loadBuilds = () => {
    const savedBuilds = getSavedBuilds();
    setBuilds(savedBuilds);
  };

  // Component icon mapping
  const componentIcons: { [key: string]: any } = {
    cpu: Cpu,
    gpu: Gpu,
    motherboard: CircuitBoard,
    ram: MemoryStick,
    storage: HardDrive,
    psu: Zap,
    cooler: Fan,
    case: Box,
  };

  // Sorted builds
  const sortedBuilds = useMemo(() => {
    let sorted = [...builds];
    
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => b.dateModified - a.dateModified);
        break;
      case 'oldest':
        sorted.sort((a, b) => a.dateModified - b.dateModified);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.totalPrice - a.totalPrice);
        break;
      case 'price-low':
        sorted.sort((a, b) => a.totalPrice - b.totalPrice);
        break;
    }
    
    return sorted;
  }, [builds, sortBy]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (deletingId === id) {
      const success = deleteBuild(id);
      if (success) {
        loadBuilds();
        setDeletingId(null);
      }
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const handleLoad = (build: SavedBuild) => {
    onLoadBuild(build);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diffInMs = now - timestamp;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Your Saved Builds ({builds.length})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                Grid
              </button>
            </div>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                       rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 
                       focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-high">Highest Price</option>
              <option value="price-low">Lowest Price</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedBuilds.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                No saved builds yet
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">
                Build your PC and click "Save Build" to save it for later
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {sortedBuilds.map((build) => {
                const componentCount = Object.values(build.components).filter(Boolean).length;
                const totalComponents = 8; // Standard PC components
                
                return viewMode === 'list' ? (
                  /* List View */
                  <div
                    key={build.id}
                    className="group border border-gray-200 dark:border-gray-700 rounded-lg p-4 
                             hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md
                             transition-all cursor-pointer"
                    onClick={() => handleLoad(build)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white 
                                     group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {build.name}
                          </h3>
                          {/* Component Count Badge */}
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 
                                       text-xs font-medium rounded-full">
                            {componentCount}/{totalComponents}
                          </span>
                        </div>

                        {/* Tags */}
                        {build.tags && build.tags.length > 0 && (
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            {build.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 
                                         text-xs rounded-md font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Component Icons Preview */}
                        <div className="flex gap-2 mb-2">
                          {['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'cooler', 'case'].map((key) => {
                            const product = build.components[key as keyof typeof build.components];
                            const Icon = componentIcons[key];
                            const hasProduct = !!product;
                            
                            return Icon ? (
                              <div
                                key={key}
                                className={`p-1.5 rounded ${
                                  hasProduct
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : 'bg-gray-100 dark:bg-gray-700'
                                }`}
                                title={`${key.toUpperCase()} ${hasProduct ? '✓' : '✗'}`}
                              >
                                <Icon className={`w-3.5 h-3.5 ${
                                  hasProduct
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-gray-400 dark:text-gray-500'
                                }`} />
                              </div>
                            ) : null;
                          })}
                        </div>

                        {/* Notes */}
                        {build.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-1 italic">
                            💭 {build.notes}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="font-medium">{build.totalPrice.toLocaleString()} IQD</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(build.dateModified)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={(e) => handleDelete(build.id, e)}
                          className={`p-2 rounded-lg transition-colors ${
                            deletingId === build.id
                              ? 'bg-red-600 text-white'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                          title={deletingId === build.id ? 'Click again to confirm delete' : 'Delete build'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {deletingId === build.id && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        ⚠️ Click delete again to confirm
                      </p>
                    )}
                  </div>
                ) : (
                  /* Grid View */
                  <div
                    key={build.id}
                    className="group border border-gray-200 dark:border-gray-700 rounded-lg p-3 
                             hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md
                             transition-all cursor-pointer"
                    onClick={() => handleLoad(build)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1
                                   group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {build.name}
                        </h3>
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 
                                     text-xs font-medium rounded-full flex-shrink-0">
                          {componentCount}/{totalComponents}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(build.id, e)}
                        className={`p-1 rounded transition-colors flex-shrink-0 ${
                          deletingId === build.id
                            ? 'bg-red-600 text-white'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={deletingId === build.id ? 'Click again to confirm delete' : 'Delete build'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tags */}
                    {build.tags && build.tags.length > 0 && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {build.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 
                                     text-xs rounded font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {build.tags.length > 2 && (
                          <span className="text-xs text-gray-500">+{build.tags.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Component Icons */}
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'cooler', 'case'].map((key) => {
                        const product = build.components[key as keyof typeof build.components];
                        const Icon = componentIcons[key];
                        const hasProduct = !!product;
                        
                        return Icon ? (
                          <div
                            key={key}
                            className={`p-1 rounded ${
                              hasProduct
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                            title={`${key.toUpperCase()} ${hasProduct ? '✓' : '✗'}`}
                          >
                            <Icon className={`w-3 h-3 ${
                              hasProduct
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`} />
                          </div>
                        ) : null;
                      })}
                    </div>

                    {/* Notes */}
                    {build.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 italic">
                        💭 {build.notes}
                      </p>
                    )}

                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {build.totalPrice.toLocaleString()} IQD
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(build.dateModified)}
                    </div>

                    {deletingId === build.id && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        ⚠️ Click to confirm
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {builds.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              💡 Click on a build to load it into the PC Builder
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
