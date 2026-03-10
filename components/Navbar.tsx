
import React, { useState } from 'react';
import { Search, Cpu, Heart, Wrench, Bell, Users, Plus } from 'lucide-react';
import { ThemeToggle, LanguageToggle } from './ui';
import UserMenu from './auth/UserMenu';
import NotificationsPanel from './NotificationsPanel';
import UnifiedNotificationBadge from './UnifiedNotificationBadge';
import { Notification } from '../services/notificationService';
import { Notification as CommunityNotification } from '../types/community-posts';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenPCBuilder?: () => void;
  notificationCount?: number;
  onNotificationClick?: (notification: Notification) => void;
  onCommunityNotificationClick?: (notification: CommunityNotification) => void;
  onNotificationCountChange?: (count: number) => void;
  onOpenCommunity?: () => void;
  onCreatePost?: () => void;
  currentView?: 'products' | 'community';
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearch,
  isLoading,
  isDarkMode,
  onToggleTheme,
  onOpenPCBuilder,
  notificationCount = 0,
  onNotificationClick,
  onCommunityNotificationClick,
  onNotificationCountChange,
  onOpenCommunity,
  onCreatePost,
  currentView = 'products'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { t } = useLanguage();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    onSearch(newVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(inputValue.trim());
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-nexus-950/80 backdrop-blur-xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logo */}
          <div
            className="flex-shrink-0 flex items-center gap-2 cursor-pointer group"
            onClick={() => window.location.reload()}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-nexus-accent to-nexus-secondary rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
              <div className="relative bg-nexus-900 p-2 rounded-lg border border-white/10">
                <Cpu className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1 ml-8">
            <button
              onClick={() => currentView !== 'products' && window.location.reload()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === 'products'
                  ? 'bg-nexus-accent/20 text-nexus-accent border border-nexus-accent/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t('nav.products')}
            </button>
            <button
              onClick={onOpenCommunity}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentView === 'community'
                  ? 'bg-nexus-accent/20 text-nexus-accent border border-nexus-accent/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="h-4 w-4 inline mr-1.5" />
              {t('nav.community')}
            </button>
          </div>

          {/* Search Bar - Only show in products view */}
          {currentView === 'products' && (
            <div className="flex-1 max-w-2xl mx-auto transition-all duration-300">
              <form onSubmit={handleSubmit} className="relative group">
                <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-20 transition duration-300 ${isFocused ? 'opacity-100 blur-sm' : 'group-hover:opacity-50'}`}></div>
                <div className="relative flex items-center bg-nexus-900 rounded-xl border border-white/10">
                  <div className="pl-4">
                    <Search className={`h-5 w-5 transition-colors duration-300 ${isLoading ? 'text-cyan-400 animate-pulse' : isFocused ? 'text-cyan-400' : 'text-gray-500'}`} />
                  </div>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="block w-full pl-3 pr-4 py-3.5 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-sm transition-all"
                    placeholder={t('nav.search')}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                  {isLoading && (
                    <div className="absolute right-4">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                      </span>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Right side - Create Post, PC Builder, Favorites & Theme Toggle */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {/* Create Post Button - Only show in community view */}
            {currentView === 'community' && onCreatePost && (
              <button
                onClick={onCreatePost}
                className="relative px-3 py-2 rounded-xl bg-nexus-accent/20 hover:bg-nexus-accent/30 border border-nexus-accent/30 hover:border-nexus-accent/50 transition-all duration-200 group"
                aria-label="Create new post"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-nexus-accent" />
                  <span className="text-sm font-medium text-nexus-accent hidden sm:inline">
                    {t('nav.createPost')}
                  </span>
                </div>
              </button>
            )}

            {/* PC Builder Button */}
            <button
              onClick={onOpenPCBuilder}
              className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 transition-all duration-200 group"
              aria-label="Open PC Builder"
            >
              <Wrench
                className="h-5 w-5 transition-all duration-200 text-gray-400 group-hover:text-cyan-400"
              />
            </button>

            {/* Unified Notifications Button */}
            <UnifiedNotificationBadge
              onChatNotificationClick={onNotificationClick}
              onCommunityNotificationClick={onCommunityNotificationClick}
            />

            {/* Language Toggle */}
            <LanguageToggle />

            {/* Theme Toggle */}
            <ThemeToggle
              isDarkMode={isDarkMode}
              onToggle={onToggleTheme}
            />

            {/* User Menu */}
            <UserMenu />
          </div>

        </div>
      </div>
    </nav>
  );
};
