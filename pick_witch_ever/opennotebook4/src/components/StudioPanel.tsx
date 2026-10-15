import React from 'react';
import { 
  Radio, 
  Presentation, 
  Video, 
  Network, 
  FileText, 
  Layers, 
  HelpCircle, 
  BarChart3, 
  Table, 
  ChevronRight, 
  Sparkles, 
  Trash2,
  FilePlus,
  Music
} from 'lucide-react';
import { PanelToggleIcon } from './Icons';
import { StudioArtifact, StudioType } from '../types';

interface StudioPanelProps {
  artifacts: StudioArtifact[];
  onSelectStudioTool: (type: StudioType, language?: string) => void;
  onOpenArtifact: (artifact: StudioArtifact) => void;
  onDeleteArtifact: (id: string) => void;
  onAddNote: () => void;
  onCollapse: () => void;
}

export const StudioPanel: React.FC<StudioPanelProps> = ({
  artifacts,
  onSelectStudioTool,
  onOpenArtifact,
  onDeleteArtifact,
  onAddNote,
  onCollapse,
}) => {
  const indicLanguages = [
    { label: 'हिन्दी', lang: 'Hindi' },
    { label: 'বাংলা', lang: 'Bengali' },
    { label: 'ગુજરાતી', lang: 'Gujarati' },
    { label: 'ಕನ್ನಡ', lang: 'Kannada' },
    { label: 'മലയാളം', lang: 'Malayalam' },
    { label: 'मराठी', lang: 'Marathi' },
    { label: 'ਪੰਜਾਬੀ', lang: 'Punjabi' },
    { label: 'தமிழ்', lang: 'Tamil' },
    { label: 'తెలుగు', lang: 'Telugu' },
  ];

  const studioTools: { type: StudioType; title: string; icon: React.ReactNode }[] = [
    {
      type: 'audio',
      title: 'Audio Overview',
      icon: <Radio className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      type: 'slides',
      title: 'Slide Deck',
      icon: <Presentation className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      type: 'video',
      title: 'Video Overview',
      icon: <Video className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      type: 'mindmap',
      title: 'Mind Map',
      icon: <Network className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      type: 'report',
      title: 'Reports',
      icon: <FileText className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      type: 'flashcards',
      title: 'Flashcards',
      icon: <Layers className="w-3.5 h-3.5 text-indigo-400" />,
    },
    {
      type: 'quiz',
      title: 'Quiz',
      icon: <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      type: 'infographic',
      title: 'Infographic',
      icon: <BarChart3 className="w-3.5 h-3.5 text-pink-400" />,
    },
    {
      type: 'table',
      title: 'Data Table',
      icon: <Table className="w-3.5 h-3.5 text-teal-400" />,
    },
  ];

  const getToolPastelClasses = (type: StudioType) => {
    switch (type) {
      case 'audio':
        return 'bg-[#f0f4ff] hover:bg-[#e4ecff] border-[#d0dcfc] text-[#1e3a8a]';
      case 'slides':
        return 'bg-[#fef9ee] hover:bg-[#fef3c7] border-[#fed7aa] text-[#9a3412]';
      case 'video':
        return 'bg-[#fef2f2] hover:bg-[#fee2e2] border-[#fecaca] text-[#991b1b]';
      case 'mindmap':
        return 'bg-[#ecfdf5] hover:bg-[#d1fae5] border-[#a7f3d0] text-[#065f46]';
      case 'report':
        return 'bg-[#fffbeb] hover:bg-[#fef3c7] border-[#fde68a] text-[#92400e]';
      case 'flashcards':
        return 'bg-[#faf5ff] hover:bg-[#f3e8ff] border-[#e9d5ff] text-[#6b21a8]';
      case 'quiz':
        return 'bg-[#f0f9ff] hover:bg-[#e0f2fe] border-[#bae6fd] text-[#075985]';
      case 'infographic':
        return 'bg-[#fdf2f8] hover:bg-[#fce7f3] border-[#fbcfe8] text-[#9d174d]';
      case 'table':
        return 'bg-[#f0fdfa] hover:bg-[#ccfbf1] border-[#99f6e4] text-[#115e59]';
      default:
        return 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#2d3340] rounded-2xl overflow-hidden relative select-none transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-[#2a2f3a]/60">
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-[#e3e3e3]">Studio</h2>
        <button 
          onClick={onCollapse}
          title="Collapse Studio panel"
          className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3] p-1 rounded dark:hover:bg-[#282d38] transition-colors cursor-pointer"
        >
          <PanelToggleIcon side="right" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-3">
        {/* Multilingual Audio Overview Banner */}
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/60 to-purple-50 dark:from-[#232833] dark:via-[#262438] dark:to-[#1e2433] border border-blue-100 dark:border-[#313745] text-[11px] leading-relaxed">
          <span className="text-gray-700 dark:text-[#a6acb8] font-normal">
            Create an Audio Overview in:{' '}
          </span>
          <span className="text-blue-600 dark:text-[#8ab4f8]">
            {indicLanguages.map((item, idx) => (
              <React.Fragment key={item.lang}>
                <button
                  onClick={() => onSelectStudioTool('audio', item.lang)}
                  className="hover:underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-normal"
                >
                  {item.label}
                </button>
                {idx < indicLanguages.length - 1 && ' , '}
              </React.Fragment>
            ))}
          </span>
        </div>

        {/* 3x3 Grid of Studio Tools */}
        <div className="grid grid-cols-3 gap-2">
          {studioTools.map((tool) => (
            <button
              key={tool.type}
              onClick={() => onSelectStudioTool(tool.type)}
              className={`${getToolPastelClasses(tool.type)} dark:bg-[#242934] dark:hover:bg-[#2c3240] border dark:border-[#323846] dark:hover:border-[#434b5c] rounded-xl p-2.5 flex flex-col justify-between h-[74px] text-left transition-all group cursor-pointer shadow-xs`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-1 rounded-md bg-white/80 dark:bg-[#1d212a] group-hover:bg-white dark:group-hover:bg-[#232732] shadow-xs transition-colors">
                  {tool.icon}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-[#6b7280] group-hover:text-gray-700 dark:group-hover:text-[#c4c7c5] transition-colors" />
              </div>
              <span className="text-[11px] font-medium leading-tight group-hover:opacity-90 dark:text-[#d3d6dc] dark:group-hover:text-white">
                {tool.title}
              </span>
            </button>
          ))}
        </div>

        {/* Studio Saved Outputs / Artifacts or Empty State */}
        {artifacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 select-none my-auto">
            {/* Custom magic pencil / wand icon */}
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#252a35] border border-gray-200 dark:border-[#333a49] flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-blue-500 dark:text-[#8ab4f8]" />
            </div>

            <h3 className="text-xs font-semibold text-gray-900 dark:text-[#e3e3e3] mb-1.5">
              Studio output will be saved here.
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6] leading-relaxed max-w-[240px]">
              After adding sources, click to add Audio Overview, Study Guide, Mind Map, and more!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            <h4 className="text-[11px] font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider px-1">
              Saved Outputs ({artifacts.length})
            </h4>
            <div className="flex flex-col gap-2">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  onClick={() => onOpenArtifact(art)}
                  className="p-3 bg-[#f8fafd] hover:bg-[#f0f4f9] border border-[#dadce0] dark:bg-[#242934] dark:hover:bg-[#2c3240] dark:border-[#323846] rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#1a1e27] border border-gray-100 dark:border-transparent flex items-center justify-center shrink-0 shadow-xs">
                      {art.type === 'audio' && <Music className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />}
                      {art.type === 'slides' && <Presentation className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
                      {art.type === 'video' && <Video className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />}
                      {art.type === 'mindmap' && <Network className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                      {art.type === 'flashcards' && <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />}
                      {art.type === 'quiz' && <HelpCircle className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />}
                      {art.type === 'report' && <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                      {art.type === 'table' && <Table className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />}
                      {art.type === 'infographic' && <BarChart3 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />}
                      {art.type === 'note' && <FilePlus className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-[#e3e3e3] truncate group-hover:text-blue-600 dark:group-hover:text-white">
                        {art.title}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-[#8a919e] capitalize">
                        {art.type} • {new Date(art.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteArtifact(art.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-[#8a919e] hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-[#6c7280]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Add note button at the bottom */}
      <div className="p-3 bg-gradient-to-t from-white via-white to-transparent dark:from-[#1e222b] dark:via-[#1e222b] dark:to-transparent flex justify-center sticky bottom-0">
        <button
          onClick={onAddNote}
          className="bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:hover:bg-[#f1f3f4] dark:text-[#1f1f1f] text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
        >
          <FilePlus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add note</span>
        </button>
      </div>
    </div>
  );
};
