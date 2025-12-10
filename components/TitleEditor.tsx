
import React, { useState, useEffect } from 'react';
import { TitleConfig, TitleLayoutMode } from '../types';
import { X, Clock, LayoutTemplate } from 'lucide-react';

interface TitleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  config: TitleConfig;
  onSave: (config: TitleConfig) => void;
}

export const TitleEditor: React.FC<TitleEditorProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<TitleConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-lg rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutTemplate size={18} className="text-blue-400"/> Edit Title & Credits
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Layout Selector */}
          <div>
             <label className="text-xs text-gray-400 block mb-3 font-semibold uppercase tracking-wider">Layout Style</label>
             <div className="grid grid-cols-3 gap-3">
                {/* Standard */}
                <button 
                  onClick={() => setLocalConfig({...localConfig, layoutMode: TitleLayoutMode.CENTERED})}
                  className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${localConfig.layoutMode === TitleLayoutMode.CENTERED ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                >
                    <div className="w-12 h-16 flex flex-col items-center justify-center gap-1 opacity-70">
                        <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                        <div className="w-6 h-0.5 bg-gray-400 rounded-full"></div>
                        <div className="w-8 h-0.5 bg-gray-500 rounded-full mt-2"></div>
                        <div className="w-8 h-0.5 bg-gray-500 rounded-full"></div>
                    </div>
                    <span className="text-[10px] text-gray-300">Standard</span>
                </button>

                {/* Vertical */}
                <button 
                  onClick={() => setLocalConfig({...localConfig, layoutMode: TitleLayoutMode.VERTICAL_RIGHT})}
                  className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${localConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                >
                    <div className="w-12 h-16 flex flex-row-reverse items-start justify-center gap-1 opacity-70">
                        <div className="w-1 h-12 bg-gray-300 rounded-full"></div>
                        <div className="w-0.5 h-8 bg-gray-400 rounded-full mt-4"></div>
                        <div className="w-0.5 h-10 bg-gray-500 rounded-full mt-2"></div>
                    </div>
                    <span className="text-[10px] text-gray-300">Vertical (CN)</span>
                </button>

                {/* Cinematic */}
                <button 
                  onClick={() => setLocalConfig({...localConfig, layoutMode: TitleLayoutMode.CINEMATIC})}
                  className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${localConfig.layoutMode === TitleLayoutMode.CINEMATIC ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
                >
                    <div className="w-12 h-16 flex flex-col items-center justify-between py-2 opacity-70">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                        <div className="flex gap-1">
                             <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                             <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                             <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                        </div>
                    </div>
                    <span className="text-[10px] text-gray-300">Cinematic</span>
                </button>
             </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <input 
                type="checkbox" 
                id="enableTitle"
                checked={localConfig.enabled}
                onChange={(e) => setLocalConfig({...localConfig, enabled: e.target.checked})}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="enableTitle" className="text-sm font-medium text-gray-200 cursor-pointer select-none">Enable Title Sequence</label>
          </div>

          <div className="space-y-4">
              <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Metadata</h3>
              
              <div>
                 <label className="text-xs text-gray-500 block mb-1">Song Title</label>
                 <input 
                    type="text" 
                    value={localConfig.title} 
                    onChange={(e) => setLocalConfig({...localConfig, title: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    placeholder="e.g. Bohemian Rhapsody"
                 />
              </div>
              
              <div>
                 <label className="text-xs text-gray-500 block mb-1">Subtitle / Album</label>
                 <input 
                    type="text" 
                    value={localConfig.subtitle} 
                    onChange={(e) => setLocalConfig({...localConfig, subtitle: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    placeholder="e.g. A Night at the Opera"
                 />
              </div>

              <div>
                 <label className="text-xs text-gray-500 block mb-1">Artist</label>
                 <input 
                    type="text" 
                    value={localConfig.artist} 
                    onChange={(e) => setLocalConfig({...localConfig, artist: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs text-gray-500 block mb-1">Lyrics By</label>
                     <input 
                        type="text" 
                        value={localConfig.author} 
                        onChange={(e) => setLocalConfig({...localConfig, author: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                     />
                  </div>

                  <div>
                     <label className="text-xs text-gray-500 block mb-1">Music By</label>
                     <input 
                        type="text" 
                        value={localConfig.composer} 
                        onChange={(e) => setLocalConfig({...localConfig, composer: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                     />
                  </div>
              </div>

              <div>
                 <label className="text-xs text-gray-500 block mb-1">Producer / Arranger</label>
                 <input 
                    type="text" 
                    value={localConfig.producer} 
                    onChange={(e) => setLocalConfig({...localConfig, producer: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                 />
              </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
             <label className="text-xs text-gray-400 block mb-2 flex items-center gap-2">
                 <Clock size={12}/> Sequence Duration
             </label>
             <div className="flex items-center gap-3">
                 <input 
                    type="range" 
                    min="3" max="20" 
                    value={localConfig.duration} 
                    onChange={(e) => setLocalConfig({...localConfig, duration: Number(e.target.value)})}
                    className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                 />
                 <span className="text-sm font-mono text-blue-300 w-10 text-right">{localConfig.duration}s</span>
             </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-800/50 flex justify-end gap-2 flex-shrink-0">
           <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
           <button 
             onClick={() => { onSave(localConfig); onClose(); }}
             className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow-lg shadow-blue-900/20"
           >
             Apply Settings
           </button>
        </div>
      </div>
    </div>
  );
};
