
import React, { useState, useEffect, useRef } from 'react';
import { LrcLine } from '../types';
import { formatTime, generateLrc } from '../utils';
import { GoogleGenAI } from "@google/genai";
import { X, Play, Pause, Save, Download, RotateCcw, Plus, Trash2, Languages, Clock, AlertTriangle, Sparkles, Loader2, Globe, ArrowRight } from 'lucide-react';

interface LyricEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lines: LrcLine[]) => void;
  initialLines: LrcLine[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const LANGUAGES = [
    { label: 'Auto Detect (Source Only)', value: 'Auto Detect' },
    { label: 'Chinese (Simplified)', value: 'Simplified Chinese' },
    { label: 'Chinese (Traditional)', value: 'Traditional Chinese' },
    { label: 'English', value: 'English' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'Korean', value: 'Korean' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'French', value: 'French' },
    { label: 'German', value: 'German' },
    { label: 'Russian', value: 'Russian' },
    { label: 'Portuguese', value: 'Portuguese' },
    { label: 'Italian', value: 'Italian' },
];

export const LyricEditor: React.FC<LyricEditorProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialLines, 
  audioRef 
}) => {
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'edit' | 'sync'>('edit'); // 'edit' = text/time tweaking, 'sync' = recording
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalOffset, setGlobalOffset] = useState(-0.2); // Default reaction time compensation
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // AI Translation State
  const [sourceLang, setSourceLang] = useState('Auto Detect');
  const [targetLang, setTargetLang] = useState('Simplified Chinese');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync state with props when opening
  useEffect(() => {
    if (isOpen) {
      if (initialLines.length > 0) {
        setLines(initialLines);
        // Also populate raw text just in case user wants to clear and restart
        setInputText(initialLines.map(l => l.text).join('\n'));
      } else {
        setLines([]);
        setInputText('');
      }
      setMode('edit');
    }
  }, [isOpen, initialLines]);

  // Audio Sync Loop
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        setIsPlaying(!audioRef.current.paused);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, audioRef]);

  // Auto scroll to active line in sync mode
  useEffect(() => {
    if (mode === 'sync' && scrollContainerRef.current) {
        const el = scrollContainerRef.current.children[activeIndex] as HTMLElement;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [activeIndex, mode]);

  const handleParseText = () => {
    const rawLines = inputText.split('\n');
    const newLines: LrcLine[] = rawLines.map(text => ({
      time: 0,
      text: text.trim()
    })).filter(l => l.text !== '' || true); // Keep empty lines as they might be instrumental breaks
    setLines(newLines);
    setMode('sync');
    setActiveIndex(0);
  };

  const handleTap = () => {
    if (activeIndex >= lines.length) return;
    
    const newLines = [...lines];
    // Apply time with offset (ensure not negative)
    newLines[activeIndex].time = Math.max(0, currentTime + globalOffset);
    setLines(newLines);
    setActiveIndex(prev => Math.min(prev + 1, lines.length - 1));
  };

  // Keyboard listener for Spacebar in Sync Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || mode !== 'sync') return;
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        if (!isPlaying) {
             audioRef.current?.play();
        } else {
             handleTap();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, isPlaying, activeIndex, lines, currentTime, globalOffset]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
        audioRef.current.currentTime = time;
    }
  };

  const updateLineTime = (index: number, newTime: number) => {
      const newLines = [...lines];
      newLines[index].time = Math.max(0, newTime);
      setLines(newLines);
  };

  const updateLineText = (index: number, newText: string) => {
    const newLines = [...lines];
    newLines[index].text = newText;
    setLines(newLines);
  };

  const insertLineAfter = (index: number) => {
      const newLines = [...lines];
      const prevTime = newLines[index].time;
      // Insert new line with same time as previous (or 0)
      newLines.splice(index + 1, 0, { time: prevTime, text: '' });
      setLines(newLines);
  };

  // --- AI Translation Logic ---
  const handleAiTranslate = async () => {
      if (lines.length === 0) return;
      if (!process.env.API_KEY) {
          alert("API Key not found. Please ensure process.env.API_KEY is configured.");
          return;
      }
      
      setIsTranslating(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Prepare the prompt
          const lyricsText = lines.map(l => l.text).filter(t => t.trim() !== ''); 
          
          const payload = JSON.stringify(lines.map(l => l.text));

          const sourceInstruction = sourceLang === 'Auto Detect' ? 'Detect the source language automatically.' : `The source language is ${sourceLang}.`;

          const prompt = `
            You are a professional lyrics translator. 
            ${sourceInstruction}
            Translate the following array of song lyric lines into ${targetLang}.
            
            Rules:
            1. Return ONLY a JSON object with a single property 'translations' which is an array of strings.
            2. The 'translations' array MUST have exactly the same number of elements as the input array.
            3. If an input line is empty, the corresponding translation string must be empty.
            4. Keep the translation concise and poetic suitable for singing/subtitles.
            5. Do NOT include the original text in the translation strings. Return ONLY the translated text.
            
            Input JSON:
            ${payload}
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const result = JSON.parse(response.text);
          
          if (result.translations && Array.isArray(result.translations)) {
              if (result.translations.length !== lines.length) {
                  alert(`Mismatch in translation line count. Expected ${lines.length}, got ${result.translations.length}. Please try again.`);
                  return;
              }

              const mergedLines: LrcLine[] = [];

              lines.forEach((line, idx) => {
                  // 1. Push Original Line
                  mergedLines.push(line);

                  // 2. Check and Push Translation Line
                  const trans = result.translations[idx];
                  // Ensure translation is valid and distinct from original (to avoid duplicating English if source is English etc)
                  if (trans && trans.trim() && trans.trim().toLowerCase() !== line.text.trim().toLowerCase()) {
                      mergedLines.push({
                          time: line.time, // Same timestamp as original
                          text: trans.trim()
                      });
                  }
              });
              
              setLines(mergedLines);
          } else {
              throw new Error("Invalid JSON response structure");
          }

      } catch (e) {
          console.error("Translation failed", e);
          alert("Translation failed. Please try again later.");
      } finally {
          setIsTranslating(false);
      }
  };

  const handleDownload = () => {
      const content = generateLrc(lines);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lyrics.lrc';
      a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-5xl h-[90vh] rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                Lyric Studio
             </h2>
             <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                <button 
                  onClick={() => setMode('edit')}
                  className={`px-3 py-1 text-xs rounded-md transition ${mode === 'edit' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Edit
                </button>
                <button 
                  onClick={() => setMode('sync')}
                  className={`px-3 py-1 text-xs rounded-md transition ${mode === 'sync' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Record Sync
                </button>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={handleDownload} className="p-2 text-gray-400 hover:text-green-400" title="Export .lrc">
                <Download size={20} />
             </button>
             <button 
                onClick={() => { onSave(lines); onClose(); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition shadow-lg hover:shadow-blue-500/20"
             >
                <Save size={16} /> Save & Apply
             </button>
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
                <X size={24} />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar Controls (Left) */}
            <div className="w-72 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-6 overflow-y-auto">
               
               {/* Transport */}
               <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-inner">
                  <div className="text-2xl font-mono text-center mb-4 text-blue-400">
                      {formatTime(currentTime)}
                  </div>
                  <div className="flex justify-center gap-4">
                      <button 
                         onClick={() => { seekTo(0); setActiveIndex(0); }} 
                         className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition"
                         title="Restart"
                      >
                         <RotateCcw size={18} />
                      </button>
                      <button 
                         onClick={togglePlay} 
                         className={`p-3 rounded-full flex items-center justify-center transition shadow-lg ${isPlaying ? 'bg-red-500 hover:bg-red-400 shadow-red-500/20' : 'bg-green-500 hover:bg-green-400 shadow-green-500/20'}`}
                      >
                         {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1"/>}
                      </button>
                  </div>
               </div>

               {/* Settings */}
               <div className="space-y-4">
                  <div className="p-3 bg-gray-800/50 rounded border border-gray-700/50">
                      <label className="text-xs text-gray-400 mb-2 block flex items-center gap-2">
                        <Clock size={12} /> Sync Offset (seconds)
                      </label>
                      <div className="flex items-center gap-2">
                          <input 
                             type="number" 
                             step="0.05" 
                             value={globalOffset} 
                             onChange={(e) => setGlobalOffset(Number(e.target.value))}
                             className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-center focus:border-blue-500 outline-none transition"
                          />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Adjusts recorded time to compensate for reaction delay.</p>
                  </div>

                   {/* AI Translation Panel */}
                   {mode === 'edit' && lines.length > 0 && (
                       <div className="p-3 bg-gradient-to-b from-blue-900/10 to-purple-900/10 rounded border border-blue-500/30">
                           <label className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                               <Sparkles size={12} /> AI Translation (Bilingual)
                           </label>
                           
                           <div className="space-y-3">
                               {/* Source Lang */}
                               <div>
                                   <label className="text-[10px] text-gray-400 block mb-1">Source Language</label>
                                   <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5">
                                       <Globe size={14} className="text-gray-500"/>
                                       <select 
                                         value={sourceLang} 
                                         onChange={(e) => setSourceLang(e.target.value)}
                                         className="bg-transparent text-xs text-gray-300 w-full outline-none border-none cursor-pointer"
                                         disabled={isTranslating}
                                       >
                                           {LANGUAGES.map(lang => (
                                               <option key={`src-${lang.value}`} value={lang.value}>{lang.label}</option>
                                           ))}
                                       </select>
                                   </div>
                               </div>

                               <div className="flex justify-center text-gray-600">
                                   <ArrowRight size={12} className="rotate-90" />
                               </div>

                               {/* Target Lang */}
                               <div>
                                   <label className="text-[10px] text-gray-400 block mb-1">Target Language</label>
                                   <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5">
                                       <Languages size={14} className="text-blue-400"/>
                                       <select 
                                         value={targetLang} 
                                         onChange={(e) => setTargetLang(e.target.value)}
                                         className="bg-transparent text-xs text-white w-full outline-none border-none cursor-pointer"
                                         disabled={isTranslating}
                                       >
                                            {/* Filter out Auto Detect for target */}
                                           {LANGUAGES.filter(l => l.value !== 'Auto Detect').map(lang => (
                                               <option key={`tgt-${lang.value}`} value={lang.value}>{lang.label}</option>
                                           ))}
                                       </select>
                                   </div>
                               </div>

                               <button 
                                   onClick={handleAiTranslate}
                                   disabled={isTranslating}
                                   className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded text-xs font-bold transition flex items-center justify-center gap-2 mt-2"
                               >
                                   {isTranslating ? (
                                       <><Loader2 size={12} className="animate-spin"/> Translating...</>
                                   ) : (
                                       <><Sparkles size={12} /> Create Bilingual</>
                                   )}
                               </button>
                               <p className="text-[9px] text-gray-500 text-center leading-tight">
                                   Generates new lines for translation with identical timestamps.
                               </p>
                           </div>
                       </div>
                   )}

                  {mode === 'edit' && lines.length > 0 && (
                      <div className="space-y-2 pt-4 border-t border-gray-800">
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Bulk Actions</label>
                          
                          <button 
                             onClick={() => {
                                 if(confirm("This will reset all timestamps to 00:00.00. Use this if you want to re-record timing from scratch.")) {
                                     setLines(lines.map(l => ({...l, time: 0})));
                                 }
                             }}
                             className="w-full py-2.5 px-3 border border-red-900/50 text-red-400 rounded text-xs hover:bg-red-900/10 flex items-center gap-2 transition"
                          >
                             <AlertTriangle size={14} /> Reset All Timestamps
                          </button>
                      </div>
                   )}
               </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 bg-gray-950 overflow-y-auto relative" ref={scrollContainerRef}>
               {lines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
                      <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-6 border border-gray-800">
                        <Plus size={32} className="text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-300 mb-2">No Lyrics Yet</h3>
                      <p className="text-gray-500 text-center mb-6">Paste your lyrics text below to get started. Don't worry about timestamps yet.</p>
                      
                      <textarea 
                         className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm leading-relaxed shadow-inner"
                         placeholder="Paste lyrics here..."
                         value={inputText}
                         onChange={(e) => setInputText(e.target.value)}
                      />
                      <button 
                         onClick={handleParseText}
                         disabled={!inputText.trim()}
                         className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg font-bold transition shadow-lg hover:shadow-blue-500/25"
                      >
                         Start Editing
                      </button>
                  </div>
               ) : (
                   <div className="p-4 space-y-1 pb-32">
                      {mode === 'sync' && (
                          <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 p-4 mb-4 text-center rounded-lg shadow-xl ring-1 ring-gray-800">
                              <p className="text-gray-400 text-sm mb-3">
                                  Press <kbd className="font-sans font-bold bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 shadow-sm mx-1">SPACE</kbd> 
                                  or tap the button below to mark the current line.
                              </p>
                              <button 
                                 onClick={handleTap}
                                 className="w-full py-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-2xl font-bold text-white shadow-xl shadow-blue-900/20 active:scale-[0.99] transition-all"
                              >
                                  TAP HERE
                              </button>
                          </div>
                      )}

                      {lines.map((line, idx) => (
                          <div 
                             key={idx}
                             className={`group flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 ${
                                 idx === activeIndex 
                                 ? 'bg-blue-900/20 border-blue-500/50 shadow-md shadow-blue-900/10' 
                                 : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800'
                             }`}
                          >
                              {/* Time Input/Display */}
                              <div className="flex flex-col items-center min-w-[80px]">
                                  {mode === 'edit' ? (
                                      <input 
                                         type="number" 
                                         step="0.1" 
                                         value={line.time === 0 ? 0 : Number(line.time).toFixed(2)}
                                         onChange={(e) => updateLineTime(idx, parseFloat(e.target.value))}
                                         className={`w-20 bg-black/40 border rounded px-2 py-1 text-xs font-mono text-center outline-none focus:border-blue-500 transition ${line.time === 0 ? 'border-red-900/50 text-gray-500' : 'border-gray-700 text-blue-300'}`}
                                         title="Timestamp (seconds)"
                                      />
                                  ) : (
                                      <span className={`font-mono text-sm ${line.time > 0 ? 'text-blue-300' : 'text-gray-600'}`}>
                                          {formatTime(line.time)}
                                      </span>
                                  )}
                              </div>

                              {/* Text Input/Display */}
                              <div className="flex-1 min-w-0">
                                  {mode === 'edit' ? (
                                      <input 
                                         type="text" 
                                         value={line.text}
                                         onChange={(e) => updateLineText(idx, e.target.value)}
                                         className="w-full bg-transparent border-none text-gray-200 focus:ring-0 p-1 text-base rounded hover:bg-white/5 transition focus:bg-white/5 placeholder-gray-700"
                                         placeholder="(Empty line)"
                                      />
                                  ) : (
                                      <div 
                                        className={`text-lg cursor-pointer truncate px-2 py-1 rounded hover:bg-white/5 transition ${idx === activeIndex ? 'text-white font-bold' : 'text-gray-400'}`}
                                        onDoubleClick={() => seekTo(line.time)}
                                        title="Double click to jump to time"
                                      >
                                          {line.text || <span className="text-gray-700 italic text-sm">Empty Line</span>}
                                      </div>
                                  )}
                              </div>

                              {/* Action Buttons (Edit Mode Only) */}
                              {mode === 'edit' && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => seekTo(line.time)}
                                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
                                          title="Play from this timestamp"
                                      >
                                          <Play size={14} />
                                      </button>
                                      <button 
                                          onClick={() => insertLineAfter(idx)}
                                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400 transition"
                                          title="Insert line below"
                                      >
                                          <Plus size={14} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                            const newLines = lines.filter((_, i) => i !== idx);
                                            setLines(newLines);
                                        }}
                                        className="p-1.5 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400 transition"
                                        title="Delete line"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                  </div>
                              )}
                          </div>
                      ))}

                      {mode === 'edit' && (
                          <button 
                             onClick={() => setLines([...lines, {time: (lines[lines.length-1]?.time || 0) + 2, text: ''}])}
                             className="w-full py-3 mt-4 border border-dashed border-gray-700 text-gray-500 rounded-lg hover:bg-gray-900 hover:text-gray-300 text-sm flex items-center justify-center gap-2 transition"
                          >
                              <Plus size={16} /> Add Line at End
                          </button>
                      )}
                   </div>
               )}
            </div>
        </div>
      </div>
    </div>
  );
};
