
import React, { useState } from 'react';
import { Search, Cpu, Heart, Wrench } from 'lucide-react';
import { ThemeToggle } from './ui';

interface NavbarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  favoritesCount?: number;
  onOpenFavorites?: () => void;
  onOpenPCBuilder?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearch,
  isLoading,
  isDarkMode,
  onToggleTheme,
  favoritesCount = 0,
  onOpenFavorites,
  onOpenPCBuilder
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tight">
              Nexus<span className="text-cyan-400">PC</span>
            </span>
          </div>

          {/* Search Bar */}
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
                  placeholder="Search GPUs, CPUs, Motherboards..."
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

          {/* Right side - PC Builder, Favorites & Theme Toggle */}
          <div className="flex-shrink-0 flex items-center gap-3">
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

            {/* Favorites Button */}
            <button
              onClick={onOpenFavorites}
              className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-500/30 transition-all duration-200 group"
              aria-label="Open favorites"
            >
              <Heart
                className={`h-5 w-5 transition-all duration-200 ${favoritesCount > 0
                    ? 'text-rose-400 fill-rose-400'
                    : 'text-gray-400 group-hover:text-rose-400'
                  }`}
              />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 rounded-full shadow-lg">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <ThemeToggle
              isDarkMode={isDarkMode}
              onToggle={onToggleTheme}
            />
          </div>

        </div>
      </div>
    </nav>
  );
};
