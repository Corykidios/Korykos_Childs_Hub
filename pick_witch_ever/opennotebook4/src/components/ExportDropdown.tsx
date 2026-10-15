import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, Check, Loader2, LucideIcon } from 'lucide-react';

export interface ExportOption {
  id: string;
  label: string;
  extension: string;
  icon?: LucideIcon;
  description?: string;
  badgeColor?: string;
  onClick: () => void | Promise<void>;
}

interface ExportDropdownProps {
  items: ExportOption[];
  buttonLabel?: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
  icon?: LucideIcon;
  variant?: 'default' | 'primary' | 'secondary' | 'subtle';
  title?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  items,
  buttonLabel = 'Export',
  buttonClassName,
  align = 'right',
  icon: IconComponent = Download,
  variant = 'default',
  title = 'Export file options',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLoadingId, setActiveLoadingId] = useState<string | null>(null);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (item: ExportOption) => {
    try {
      setActiveLoadingId(item.id);
      const result = item.onClick();
      if (result instanceof Promise) {
        await result;
      }
      setLastCopiedId(item.id);
      setTimeout(() => setLastCopiedId(null), 1500);
      setIsOpen(false);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setActiveLoadingId(null);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm border border-blue-500';
      case 'secondary':
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-500';
      case 'subtle':
        return 'bg-transparent hover:bg-gray-100 dark:hover:bg-[#282f3e] text-gray-700 dark:text-gray-300 border border-transparent';
      default:
        return 'bg-white dark:bg-[#202530] hover:bg-gray-50 dark:hover:bg-[#282f3d] border border-gray-200 dark:border-[#333b4c] text-gray-700 dark:text-gray-200 shadow-xs';
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${getVariantStyles()} ${buttonClassName || ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span>{buttonLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-64 rounded-2xl bg-white dark:bg-[#1c202a] border border-gray-200 dark:border-[#323948] shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-[#282f3d] mb-1">
            <span className="text-[10px] font-semibold tracking-wider text-gray-400 dark:text-gray-500 uppercase">
              Export Formats
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto py-0.5 space-y-0.5 px-1.5">
            {items.map((item) => {
              const ItemIcon = item.icon || Download;
              const isLoading = activeLoadingId === item.id;
              const isDone = lastCopiedId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  disabled={isLoading}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 hover:bg-gray-100 dark:hover:bg-[#272d3b] text-gray-800 dark:text-gray-200 transition-colors cursor-pointer group disabled:opacity-50"
                  role="menuitem"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-[#252b38] flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      ) : isDone ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ItemIcon className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="text-[10px] text-gray-400 dark:text-[#8a919e] truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                    item.badgeColor || 'bg-gray-100 dark:bg-[#282e3c] text-gray-600 dark:text-gray-300'
                  }`}>
                    {item.extension}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
