import React, { useState } from 'react';
import { X, FilePlus, Save } from 'lucide-react';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (title: string, content: string) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSaveNote,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!content.trim()) return;
    onSaveNote(title.trim() || 'Untitled Note', content.trim());
    setTitle('');
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#333a49] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#2d3340]">
          <div className="flex items-center gap-2">
            <FilePlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">Add Studio Note</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2f3b] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Note title (e.g., Key takeaways, Synthesis draft)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          <textarea
            rows={8}
            placeholder="Write your thoughts, outline, or synthesis here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl p-3.5 text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Note</span>
          </button>
        </div>
      </div>
    </div>
  );
};
