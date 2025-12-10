
import React, { useRef } from 'react';
import { Upload, Music, FileText, Image as ImageIcon, Trash2, Settings, Type, Edit3, Copy } from 'lucide-react';
import { BackgroundMedia, MediaType, LyricStyle, AspectRatio } from '../types';

interface ControlPanelProps {
  onAudioUpload: (file: File) => void;
  onLrcUpload: (text: string) => void;
  onBackgroundUpload: (files: FileList) => void;
  backgrounds: BackgroundMedia[];
  onRemoveBackground: (id: string) => void;
  onDuplicateBackground: (id: string) => void;
  onUpdateBackgroundDuration: (id: string, duration: number) => void;
  lyricStyle: LyricStyle;
  setLyricStyle: (style: LyricStyle) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  audioFileName?: string;
  onOpenLyricEditor: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAudioUpload,
  onLrcUpload,
  onBackgroundUpload,
  backgrounds,
  onRemoveBackground,
  onDuplicateBackground,
  onUpdateBackgroundDuration,
  lyricStyle,
  setLyricStyle,
  aspectRatio,
  setAspectRatio,
  audioFileName,
  onOpenLyricEditor,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleLrcFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      onLrcUpload(text);
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full overflow-hidden z-20">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          VibeFlow
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Section: Assets */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Upload size={14} /> Assets
          </h2>
          
          <div className="space-y-2">
            <button 
              onClick={() => audioInputRef.current?.click()}
              className="w-full flex items-center gap-2 p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
            >
              <Music size={16} className="text-blue-400" />
              <span className="truncate">{audioFileName || 'Upload MP3'}</span>
            </button>
            <input type="file" ref={audioInputRef} onChange={(e) => e.target.files?.[0] && onAudioUpload(e.target.files[0])} accept="audio/*" className="hidden" />

            <div className="flex gap-2">
                <button 
                  onClick={() => lrcInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
                >
                  <FileText size={16} className="text-green-400" />
                  <span>Import LRC</span>
                </button>
                <button 
                  onClick={onOpenLyricEditor}
                  className="w-10 flex items-center justify-center p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
                  title="Create/Edit Lyrics"
                >
                  <Edit3 size={16} className="text-yellow-400" />
                </button>
            </div>
            <input type="file" ref={lrcInputRef} onChange={handleLrcFile} accept=".lrc,.txt" className="hidden" />

            <button 
              onClick={() => bgInputRef.current?.click()}
              className="w-full flex items-center gap-2 p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
            >
              <ImageIcon size={16} className="text-purple-400" />
              <span>Add Backgrounds</span>
            </button>
            <input type="file" ref={bgInputRef} onChange={(e) => e.target.files && onBackgroundUpload(e.target.files)} accept="image/*,video/*" multiple className="hidden" />
          </div>
        </div>

        {/* Section: Backgrounds */}
        {backgrounds.length > 0 && (
          <div className="space-y-3">
             <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Playlist</h2>
             <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {backgrounds.map((bg, idx) => (
                  <div key={bg.id} className="flex flex-col gap-2 p-2 bg-gray-800 rounded border border-gray-700 group">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-black rounded overflow-hidden flex-shrink-0 relative">
                        {bg.type === MediaType.VIDEO ? (
                            <video src={bg.src} className="w-full h-full object-cover" />
                        ) : (
                            <img src={bg.src} className="w-full h-full object-cover" alt="" />
                        )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs truncate text-gray-300 mb-1">{bg.file.name}</p>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">Dur:</span>
                                <input 
                                    type="number" 
                                    value={bg.duration}
                                    onChange={(e) => onUpdateBackgroundDuration(bg.id, Number(e.target.value))}
                                    className="w-12 bg-gray-900 text-xs border border-gray-700 rounded px-1 text-gray-300"
                                    min="0"
                                    title={bg.type === MediaType.VIDEO ? "0 = Auto (Video Length)" : "Duration in seconds"}
                                />
                                <span className="text-[10px] text-gray-500">s</span>
                                {bg.type === MediaType.VIDEO && bg.duration === 0 && (
                                    <span className="text-[9px] px-1 bg-gray-700 rounded text-gray-400">Auto</span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                             <button onClick={() => onDuplicateBackground(bg.id)} className="text-gray-500 hover:text-blue-400" title="Duplicate">
                                <Copy size={14} />
                            </button>
                            <button onClick={() => onRemoveBackground(bg.id)} className="text-gray-500 hover:text-red-400" title="Remove">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Section: Settings */}
        <div className="space-y-4">
           <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
             <Settings size={14} /> Output Settings
           </h2>
           
           <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Resolution / Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(AspectRatio).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`text-xs p-1.5 rounded border ${
                        aspectRatio === ratio 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
           </div>
        </div>

        {/* Section: Lyric Style */}
        <div className="space-y-4">
           <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
             <Type size={14} /> Lyric Style
           </h2>
           
           <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Font Family</label>
                <input 
                  type="text"
                  value={lyricStyle.fontFamily}
                  onChange={(e) => setLyricStyle({...lyricStyle, fontFamily: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                  placeholder="e.g. Arial, Impact"
                />
                <p className="text-[10px] text-gray-500 mt-1">Enter exact system font name</p>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Font Size ({lyricStyle.fontSize}px)</label>
                <input 
                  type="range" min="20" max="150" 
                  value={lyricStyle.fontSize} 
                  onChange={(e) => setLyricStyle({...lyricStyle, fontSize: Number(e.target.value)})}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Position Y ({Math.round(lyricStyle.positionY * 100)}%)</label>
                <input 
                  type="range" min="0.1" max="0.9" step="0.05"
                  value={lyricStyle.positionY} 
                  onChange={(e) => setLyricStyle({...lyricStyle, positionY: Number(e.target.value)})}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

               <div>
                <label className="text-xs text-gray-400 block mb-1">BG Overlay Opacity</label>
                <input 
                  type="range" min="0" max="0.8" step="0.1"
                  value={lyricStyle.bgOverlayOpacity} 
                  onChange={(e) => setLyricStyle({...lyricStyle, bgOverlayOpacity: Number(e.target.value)})}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Text Color</label>
                  <input 
                    type="color" 
                    value={lyricStyle.activeColor} 
                    onChange={(e) => setLyricStyle({...lyricStyle, activeColor: e.target.value})}
                    className="w-full h-8 bg-transparent cursor-pointer rounded"
                  />
                </div>
                 <div>
                  <label className="text-xs text-gray-400 block mb-1">Shadow</label>
                  <input 
                    type="color" 
                    value={lyricStyle.shadowColor} 
                    onChange={(e) => setLyricStyle({...lyricStyle, shadowColor: e.target.value})}
                    className="w-full h-8 bg-transparent cursor-pointer rounded"
                  />
                </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
