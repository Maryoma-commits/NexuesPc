import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
    isDarkMode: boolean;
    onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDarkMode, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            className="relative w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            style={{
                background: isDarkMode
                    ? 'linear-gradient(to right, #1e293b, #0f172a)'
                    : 'linear-gradient(to right, #38bdf8, #0ea5e9)'
            }}
            aria-label="Toggle theme"
        >
            {/* Track glow effect */}
            <div
                className={`absolute inset-0 rounded-full transition-opacity duration-300 ${isDarkMode ? 'opacity-0' : 'opacity-30'}`}
                style={{ boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}
            />

            {/* Sliding circle */}
            <div
                className={`
          relative w-6 h-6 rounded-full 
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${isDarkMode ? 'translate-x-0 bg-slate-700' : 'translate-x-8 bg-white'}
        `}
                style={{
                    boxShadow: isDarkMode
                        ? '0 2px 8px rgba(0,0,0,0.3)'
                        : '0 2px 8px rgba(0,0,0,0.2)'
                }}
            >
                {/* Icon */}
                {isDarkMode ? (
                    <Moon className="w-3.5 h-3.5 text-cyan-300" />
                ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
            </div>

            {/* Stars in dark mode */}
            {isDarkMode && (
                <>
                    <div className="absolute right-2.5 top-1.5 w-1 h-1 bg-white/60 rounded-full animate-pulse" />
                    <div className="absolute right-4 top-3 w-0.5 h-0.5 bg-white/40 rounded-full" />
                    <div className="absolute right-2 bottom-2 w-0.5 h-0.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                </>
            )}
        </button>
    );
};

export default ThemeToggle;
