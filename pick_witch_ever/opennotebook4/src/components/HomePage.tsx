import React, { useState } from 'react';
import { 
  Plus, 
  Settings, 
  Search, 
  Check, 
  LayoutGrid, 
  List, 
  ChevronDown, 
  Globe, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Sun,
  Moon
} from 'lucide-react';
import { Notebook, AppTheme } from '../types';

interface HomePageProps {
  notebooks: Notebook[];
  onOpenNotebook: (id: string) => void;
  onCreateNotebook: () => void;
  onOpenSettings: () => void;
  onDeleteNotebook: (id: string) => void;
  onDuplicateNotebook: (id: string) => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  notebooks,
  onOpenNotebook,
  onCreateNotebook,
  onOpenSettings,
  onDeleteNotebook,
  onDuplicateNotebook,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'All' | 'My notebooks' | 'Discover' | 'Collections'>('My notebooks');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'az' | 'sources'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter & Sort
  const filteredNotebooks = notebooks
    .filter((nb) => nb.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'recent') return b.updatedAt - a.updatedAt;
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      return b.sources.length - a.sources.length;
    });

  return (
    <div className="min-h-screen w-full bg-[#f0f4f9] dark:bg-[#13161c] text-[#1f1f1f] dark:text-[#e3e3e3] flex flex-col select-none overflow-y-auto transition-colors">
      {/* 1. Global Navigation Header */}
      <header className="h-14 px-8 flex items-center justify-between bg-white dark:bg-[#13161c] border-b border-[#dadce0] dark:border-[#20242e] sticky top-0 z-30 transition-colors">
        {/* Left: Gemini Notebook Branding */}
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center relative overflow-hidden shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-white/80 border-t-transparent animate-[spin_8s_linear_infinite]" />
            <div className="absolute w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="text-[17px] font-medium text-gray-900 dark:text-white tracking-normal">
            NotebookLM
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="border border-[#dadce0] dark:border-[#343946] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-full border border-[#dadce0] dark:border-[#343946] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#1e222b] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
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

      {/* 2. Sub-header Navigation & Controls */}
      <div className="px-8 pt-6 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Tabs */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('All')}
            className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
              activeTab === 'All' 
                ? 'bg-white dark:bg-[#2a303e] text-gray-900 dark:text-white font-semibold shadow-sm border border-[#dadce0] dark:border-transparent' 
                : 'text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#232833]'
            }`}
          >
            All
          </button>

          <button
            onClick={() => setActiveTab('My notebooks')}
            className={`px-4 py-1.5 rounded-full transition-colors cursor-pointer ${
              activeTab === 'My notebooks' 
                ? 'bg-white dark:bg-[#2a303e] text-gray-900 dark:text-white font-semibold shadow-sm border border-[#dadce0] dark:border-transparent' 
                : 'text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#232833]'
            }`}
          >
            My notebooks
          </button>

          <button
            onClick={() => setActiveTab('Discover')}
            className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'Discover' 
                ? 'bg-white dark:bg-[#2a303e] text-gray-900 dark:text-white font-semibold shadow-sm border border-[#dadce0] dark:border-transparent' 
                : 'text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#232833]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>

          <button
            onClick={() => setActiveTab('Collections')}
            className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
              activeTab === 'Collections' 
                ? 'bg-white dark:bg-[#2a303e] text-gray-900 dark:text-white font-semibold shadow-sm border border-[#dadce0] dark:border-transparent' 
                : 'text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#232833]'
            }`}
          >
            Collections
          </button>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2.5">
          {/* Search Input / Icon */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <input
                type="text"
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onBlur={() => !searchQuery && setIsSearchOpen(false)}
                className="bg-white dark:bg-[#1c202a] border border-[#dadce0] dark:border-[#2e3442] rounded-full px-3.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48 transition-all shadow-sm"
              />
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1e222b] transition-colors"
                title="Search notebooks"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Segmented View Mode Toggle */}
          <div className="bg-white dark:bg-[#1c202a] border border-[#dadce0] dark:border-[#2e3442] rounded-full p-0.5 flex items-center shadow-sm">
            <button
              title="Selection mode"
              className="p-1.5 rounded-full text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-gray-100 dark:bg-[#282e3c] text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-1.5 rounded-full transition-colors ${
                viewMode === 'list' 
                  ? 'bg-gray-100 dark:bg-[#282e3c] text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sort Dropdown Pill */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="border border-[#dadce0] dark:border-[#2e3442] bg-white dark:bg-[#1c202a] hover:bg-gray-50 dark:hover:bg-[#242935] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs font-medium px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <span>{sortBy === 'recent' ? 'Most recent' : sortBy === 'az' ? 'Title A-Z' : 'Most sources'}</span>
              <ChevronDown className="w-3 h-3 text-gray-500 dark:text-[#8a919e]" />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-white dark:bg-[#252a35] border border-[#dadce0] dark:border-[#383e4e] rounded-xl shadow-xl py-1 z-30">
                <button
                  onClick={() => { setSortBy('recent'); setShowSortMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#2f3544] hover:text-gray-900 dark:hover:text-white"
                >
                  Most recent
                </button>
                <button
                  onClick={() => { setSortBy('az'); setShowSortMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#2f3544] hover:text-gray-900 dark:hover:text-white"
                >
                  Title A-Z
                </button>
                <button
                  onClick={() => { setSortBy('sources'); setShowSortMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#2f3544] hover:text-gray-900 dark:hover:text-white"
                >
                  Most sources
                </button>
              </div>
            )}
          </div>

          {/* + Create new pill button */}
          <button
            onClick={onCreateNotebook}
            className="bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:hover:bg-[#f1f3f4] dark:text-[#1f1f1f] text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create new</span>
          </button>
        </div>
      </div>

      {/* 3. Section Title */}
      <div className="px-8 pt-4 pb-4">
        <h2 className="text-xl font-medium text-gray-900 dark:text-white">
          My notebooks
        </h2>
      </div>

      {/* 4. Notebooks Display: Grid or List */}
      <main className="px-8 pb-12 flex-1">
        {viewMode === 'grid' ? (
          /* 5-Column Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* First Card: Create new notebook */}
            <div
              onClick={onCreateNotebook}
              className="h-[185px] rounded-2xl bg-white dark:bg-[#171a22] hover:bg-[#f8fafd] dark:hover:bg-[#1f232d] border-2 border-dashed border-[#dadce0] dark:border-[#2b303d] hover:border-blue-500 dark:hover:border-[#3d4556] flex flex-col items-center justify-center cursor-pointer transition-all group shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#242936] group-hover:bg-blue-50 dark:group-hover:bg-[#2e3444] flex items-center justify-center mb-3 transition-colors">
                <Plus className="w-6 h-6 text-gray-600 dark:text-[#9aa0a6] group-hover:text-blue-600 dark:group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-[#e3e3e3] group-hover:text-gray-900 dark:group-hover:text-white">
                Create new notebook
              </span>
            </div>

            {/* Notebook Cards */}
            {filteredNotebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => onOpenNotebook(nb.id)}
                className="h-[185px] rounded-2xl bg-white dark:bg-[#20242e] hover:bg-white dark:hover:bg-[#272c38] border border-[#dadce0] dark:border-[#2d3340] hover:border-[#bdc1c6] dark:hover:border-[#434b5c] p-4 flex flex-col justify-between cursor-pointer transition-all shadow-sm hover:shadow-md relative group"
              >
                {/* Top Row: Emoji Icon & Kebab Menu */}
                <div className="flex items-start justify-between">
                  <span className="text-2xl select-none">{nb.emoji}</span>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === nb.id ? null : nb.id);
                      }}
                      className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-[#9aa0a6] dark:hover:text-white dark:hover:bg-[#2f3544] transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {menuOpenId === nb.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#252a35] border border-[#dadce0] dark:border-[#383e4e] rounded-xl shadow-xl py-1 z-40"
                      >
                        <button
                          onClick={() => {
                            onDuplicateNotebook(nb.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#2f3544] hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5" /> Duplicate
                        </button>
                        <button
                          onClick={() => {
                            onDeleteNotebook(nb.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2f3544] flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Notebook Title */}
                <div className="my-auto">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors">
                    {nb.title}
                  </h3>
                </div>

                {/* Bottom Row: Date & Source Count */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-[#9aa0a6] pt-2 border-t border-gray-100 dark:border-[#292f3c]/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{formatDate(nb.updatedAt)}</span>
                    <span>•</span>
                    <span>
                      {nb.sources.length} source{nb.sources.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {nb.isShared && (
                    <span title="Shared"><Globe className="w-3.5 h-3.5 text-gray-400 dark:text-[#8a919e] shrink-0" /></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-[#1c202a] border border-[#dadce0] dark:border-[#2a2f3a] rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-[#282d38] shadow-sm">
            {filteredNotebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => onOpenNotebook(nb.id)}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#232734] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-xl shrink-0">{nb.emoji}</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    {nb.title}
                  </span>
                </div>

                <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-[#9aa0a6] shrink-0">
                  <span>{formatDate(nb.updatedAt)}</span>
                  <span className="w-24 text-right">
                    {nb.sources.length} source{nb.sources.length === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotebook(nb.id);
                    }}
                    className="p-1 rounded text-gray-400 dark:text-[#9aa0a6] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
