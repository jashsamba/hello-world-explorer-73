import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage, Language } from '../contexts/LanguageContext';

const LanguageSelector: React.FC = () => {
  const {
    language,
    setLanguage,
    t
  } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    {
      code: 'en' as Language,
      flag: '/gb.png',
      name: 'English'
    },
    {
      code: 'fr' as Language,
      flag: '/fr.png',
      name: 'Français'
    }
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setIsOpen(false);
  };

  return (
    <div className="language-selector-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="language-selector mx-[4px] mt-[-6px] py-[5px] px-[5px]"
      >
        <img src={currentLanguage?.flag} alt="" className="language-flag w-6 h-4 object-cover rounded-sm" />
        <span className="language-name">{currentLanguage?.name}</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="language-dropdown">
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`language-option ${language === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <img src={lang.flag} alt="" className="language-flag w-6 h-4 object-cover rounded-sm" />
              <span className="language-name">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
