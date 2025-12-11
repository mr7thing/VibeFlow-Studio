
import React, { useRef, useState } from 'react';
import { Upload, Music, FileText, Image as ImageIcon, Trash2, Settings, Type, Edit3, Copy, Sparkles, MoveHorizontal, MoveVertical, Heading, Layers, ChevronUp, ChevronDown, FolderHeart } from 'lucide-react';
import { BackgroundMedia, MediaType, LyricStyle, AspectRatio, LyricEffect } from '../types';

interface ControlPanelProps {
  onAudioUpload: (file: File) => void;
  onLrcUpload: (text: string) => void;
  onBackgroundUpload: (files: FileList) => void;
  backgrounds: BackgroundMedia[];
  onRemoveBackground: (id: string) => void;
  onDuplicateBackground: (id: string) => void;
  onMoveBackground: (id: string, direction: 'up' | 'down') => void;
  onUpdateBackgroundDuration: (id: string, duration: number) => void;
  
  // Lyric Style
  lyricStyle: LyricStyle;
  setLyricStyle: (style: LyricStyle) => void;
  
  // Title Style
  titleStyle: LyricStyle;
  setTitleStyle: (style: LyricStyle) => void;

  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  audioFileName?: string;
  onOpenLyricEditor: () => void;
  onOpenTitleEditor: () => void;
  onOpenProjectManager: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onAudioUpload,
  onLrcUpload,
  onBackgroundUpload,
  backgrounds,
  onRemoveBackground,
  onDuplicateBackground,
  onMoveBackground,
  onUpdateBackgroundDuration,
  lyricStyle,
  setLyricStyle,
  titleStyle,
  setTitleStyle,
  aspectRatio,
  setAspectRatio,
  audioFileName,
  onOpenLyricEditor,
  onOpenTitleEditor,
  onOpenProjectManager,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Toggle state: 'lyric' or 'title'
  const [styleMode, setStyleMode] = useState<'lyric' | 'title'>('lyric');

  // Helper to get current style object based on mode
  const currentStyle = styleMode === 'lyric' ? lyricStyle : titleStyle;
  const setCurrentStyle = styleMode === 'lyric' ? setLyricStyle : setTitleStyle;

  const handleLrcFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      onLrcUpload(text);
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full overflow-hidden z-20">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          VibeFlow
        </h1>
        <button 
           onClick={onOpenProjectManager}
           className="p-2 bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white rounded-lg transition"
           title="Manage Projects (Save/Load)"
        >
            <FolderHeart size={18} />
        </button>
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

            {/* Lyric & Title Actions */}
            <div className="flex gap-2">
                <button 
                  onClick={() => lrcInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
                  title="Import LRC File"
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
              onClick={onOpenTitleEditor}
              className="w-full flex items-center gap-2 p-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm border border-gray-700"
            >
              <Heading size={16} className="text-orange-400" />
              <span>Edit Title / Credits</span>
            </button>

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
             <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Playlist ({backgrounds.length})</h2>
                <span className="text-[10px] text-gray-500">Order plays top to bottom</span>
             </div>
             
             <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {backgrounds.map((bg, idx) => (
                  <div key={bg.id} className="flex gap-2 p-2 bg-gray-800 rounded border border-gray-700 group relative">
                    {/* Order Controls */}
                    <div className="flex flex-col justify-center gap-1 border-r border-gray-700 pr-1.5 mr-0.5">
                        <button 
                            onClick={() => onMoveBackground(bg.id, 'up')}
                            disabled={idx === 0}
                            className="text-gray-500 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-gray-500"
                        >
                            <ChevronUp size={14} />
                        </button>
                        <button 
                            onClick={() => onMoveBackground(bg.id, 'down')}
                            disabled={idx === backgrounds.length - 1}
                            className="text-gray-500 hover:text-blue-400 disabled:opacity-30 disabled:hover:text-gray-500"
                        >
                            <ChevronDown size={14} />
                        </button>
                    </div>

                    <div className="w-12 h-12 bg-black rounded overflow-hidden flex-shrink-0 relative self-center">
                        {bg.type === MediaType.VIDEO ? (
                            <video src={bg.src} className="w-full h-full object-cover" />
                        ) : (
                            <img src={bg.src} className="w-full h-full object-cover" alt="" />
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="flex justify-between items-start gap-1">
                            <p className="text-xs truncate text-gray-300 max-w-[80px]" title={bg.file.name}>{bg.file.name}</p>
                            <div className="flex gap-1">
                                <button onClick={() => onDuplicateBackground(bg.id)} className="text-gray-500 hover:text-blue-400" title="Duplicate to end">
                                    <Copy size={12} />
                                </button>
                                <button onClick={() => onRemoveBackground(bg.id)} className="text-gray-500 hover:text-red-400" title="Remove">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-gray-500">Dur:</span>
                            <input 
                                type="number" 
                                value={bg.duration}
                                onChange={(e) => onUpdateBackgroundDuration(bg.id, Number(e.target.value))}
                                className="w-10 bg-gray-900 text-xs border border-gray-700 rounded px-1 text-gray-300 text-center"
                                min="0"
                            />
                            <span className="text-[10px] text-gray-500">s</span>
                            {bg.type === MediaType.VIDEO && bg.duration === 0 && (
                                <span className="text-[9px] px-1 bg-gray-700 rounded text-gray-400">Auto</span>
                            )}
                        </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Section: Output Settings */}
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

        {/* Section: Style Controls */}
        <div className="space-y-4 pb-12">
           <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
             <Type size={14} /> Style Editor
           </h2>
           
           {/* Style Mode Switcher */}
           <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
               <button 
                  onClick={() => setStyleMode('lyric')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs rounded transition ${styleMode === 'lyric' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
               >
                   <Layers size={12}/> Lyrics
               </button>
               <button 
                  onClick={() => setStyleMode('title')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs rounded transition ${styleMode === 'title' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
               >
                   <Heading size={12}/> Title/Credits
               </button>
           </div>

           <div className="space-y-4 pt-2">
              {/* Font */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Font Family</label>
                <input 
                  type="text"
                  value={currentStyle.fontFamily}
                  onChange={(e) => setCurrentStyle({...currentStyle, fontFamily: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300"
                  placeholder="e.g. Arial, Impact"
                />
              </div>

              {/* Animation Effect */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1">
                   <Sparkles size={10} className="text-yellow-400" /> Animation Effect
                </label>
                <select 
                    value={currentStyle.animationEffect}
                    onChange={(e) => setCurrentStyle({...currentStyle, animationEffect: e.target.value as LyricEffect})}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-blue-500 outline-none"
                >
                    <option value={LyricEffect.NONE}>None</option>
                    <option value={LyricEffect.FADE_UP}>Fade Slide Up</option>
                    <option value={LyricEffect.TYPEWRITER}>Typewriter</option>
                    {styleMode === 'lyric' && <option value={LyricEffect.KARAOKE}>Karaoke Wipe</option>}
                    <option value={LyricEffect.BREATHING}>Breathing Glow</option>
                    <option value={LyricEffect.SCATTER}>Scatter Exit</option>
                </select>
              </div>

              {/* Position & Size */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <MoveVertical size={10} /> Pos Y ({Math.round(currentStyle.positionY * 100)}%)
                    </label>
                    <input 
                      type="range" min="0.1" max="0.9" step="0.05"
                      value={currentStyle.positionY} 
                      onChange={(e) => setCurrentStyle({...currentStyle, positionY: Number(e.target.value)})}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>
                 <div>
                    <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <MoveHorizontal size={10} /> Pos X ({Math.round(currentStyle.positionX * 100)}%)
                    </label>
                    <input 
                      type="range" min="0.1" max="0.9" step="0.05"
                      value={currentStyle.positionX} 
                      onChange={(e) => setCurrentStyle({...currentStyle, positionX: Number(e.target.value)})}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Base Font Size ({currentStyle.fontSize}px)</label>
                <input 
                  type="range" min="20" max="150" 
                  value={currentStyle.fontSize} 
                  onChange={(e) => setCurrentStyle({...currentStyle, fontSize: Number(e.target.value)})}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Primary Color</label>
                  <input 
                    type="color" 
                    value={currentStyle.activeColor} 
                    onChange={(e) => setCurrentStyle({...currentStyle, activeColor: e.target.value})}
                    className="w-full h-8 bg-transparent cursor-pointer rounded border border-gray-700"
                  />
                </div>
                {styleMode === 'lyric' && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Inactive Color</label>
                    <input 
                      type="color" 
                      value={currentStyle.fontColor.slice(0, 7)} 
                      onChange={(e) => setCurrentStyle({...currentStyle, fontColor: e.target.value})}
                      className="w-full h-8 bg-transparent cursor-pointer rounded border border-gray-700"
                    />
                  </div>
                )}
              </div>

               {/* Shadow & Glow */}
              <div className="p-3 bg-gray-800 rounded border border-gray-700 space-y-3">
                 <h3 className="text-xs font-semibold text-gray-400 uppercase">Effects</h3>
                 
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Shadow Color</label>
                        <input 
                            type="color" 
                            value={currentStyle.shadowColor} 
                            onChange={(e) => setCurrentStyle({...currentStyle, shadowColor: e.target.value})}
                            className="w-full h-6 bg-transparent cursor-pointer rounded"
                        />
                    </div>
                     <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Shadow Blur</label>
                        <input 
                            type="number" 
                            min="0" max="50"
                            value={currentStyle.shadowBlur} 
                            onChange={(e) => setCurrentStyle({...currentStyle, shadowBlur: Number(e.target.value)})}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-1 text-xs text-gray-300"
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Glow Color</label>
                        <input 
                            type="color" 
                            value={currentStyle.glowColor} 
                            onChange={(e) => setCurrentStyle({...currentStyle, glowColor: e.target.value})}
                            className="w-full h-6 bg-transparent cursor-pointer rounded"
                        />
                    </div>
                     <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Glow Blur</label>
                        <input 
                            type="number" 
                            min="0" max="100"
                            value={currentStyle.glowBlur} 
                            onChange={(e) => setCurrentStyle({...currentStyle, glowBlur: Number(e.target.value)})}
                            className="w-full bg-gray-900 border border-gray-700 rounded px-1 text-xs text-gray-300"
                        />
                    </div>
                 </div>
              </div>
              
              {/* Only show global overlay opacity in one place or shared? Let's keep it shared but editable in both */}
               <div>
                <label className="text-xs text-gray-400 block mb-1">BG Overlay Opacity</label>
                <input 
                  type="range" min="0" max="0.8" step="0.1"
                  value={currentStyle.bgOverlayOpacity} 
                  onChange={(e) => setCurrentStyle({...currentStyle, bgOverlayOpacity: Number(e.target.value)})}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
