import React, { useState } from 'react';
import { Copy, Share2, Settings, Plus, Check, ArrowLeft, Sun, Moon } from 'lucide-react';
import { AppTheme } from '../types';

interface HeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  onOpenSettings: () => void;
  onCreateNewNotebook: () => void;
  onBackToHome?: () => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onTitleChange,
  onOpenSettings,
  onCreateNewNotebook,
  onBackToHome,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <header className="h-14 px-5 flex items-center justify-between bg-white dark:bg-[#0e1117] border-b border-[#dadce0] dark:border-[#20242e] select-none transition-colors">
      {/* Left: Home Navigation, Logo & Notebook Title */}
      <div className="flex items-center gap-3">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            title="Back to notebooks"
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-[#9aa0a6] dark:hover:text-white dark:hover:bg-[#1e222b] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* NotebookLM Swirl Logo */}
        <div 
          onClick={onBackToHome}
          title="Back to Home"
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-sm relative overflow-hidden group cursor-pointer shrink-0"
        >
          <div className="w-6 h-6 rounded-full border-2 border-white/80 border-t-transparent animate-[spin_8s_linear_infinite]" />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
        </div>

        {/* Editable Title */}
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setIsEditing(false)}
            autoFocus
            className="text-lg font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-[#1e222b] px-2 py-0.5 rounded border border-blue-500 outline-none"
          />
        ) : (
          <h1
            onClick={() => setIsEditing(true)}
            title="Click to rename"
            className="text-[17px] font-normal text-gray-800 hover:text-black dark:text-[#e3e3e3] dark:hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#1e222b]/60 transition-colors"
          >
            {title || 'Untitled notebook'}
          </h1>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* + Create notebook pill */}
        <button
          onClick={onCreateNewNotebook}
          className="bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:hover:bg-[#f1f3f4] dark:text-[#1f1f1f] text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Create notebook</span>
        </button>

        {/* Copy pill */}
        <button
          onClick={handleCopy}
          className="border border-[#dadce0] dark:border-[#383d4a] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {/* Share pill */}
        <button
          onClick={handleShare}
          className="border border-[#dadce0] dark:border-[#383d4a] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {shared ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{shared ? 'Link copied' : 'Share'}</span>
        </button>

        {/* Settings pill */}
        <button
          onClick={onOpenSettings}
          className="border border-[#dadce0] dark:border-[#383d4a] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-full border border-[#dadce0] dark:border-[#383d4a] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer ml-0.5"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
