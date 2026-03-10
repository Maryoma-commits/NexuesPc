import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 transition-all duration-200 group"
      aria-label="Toggle language"
      title={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
    >
      <div className="flex items-center gap-1.5">
        <Languages className="h-5 w-5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
        <span className="text-xs font-medium text-gray-400 group-hover:text-cyan-400 transition-colors">
          {language === 'en' ? 'AR' : 'EN'}
        </span>
      </div>
    </button>
  );
};
