
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { LyricEditor } from './components/LyricEditor';
import { BackgroundMedia, MediaType, LyricStyle, LrcLine, AspectRatio } from './types';
import { parseLrc, formatTime, getResolution } from './utils';
import { Play, Pause, Circle, Download, AlertCircle } from 'lucide-react';

const DEFAULT_LYRIC_STYLE: LyricStyle = {
  fontSize: 40,
  fontFamily: 'sans-serif',
  fontColor: '#ffffff80',
  activeColor: '#ffffff',
  shadowColor: '#000000',
  shadowBlur: 10,
  positionY: 0.8,
  bgOverlayOpacity: 0.3,
};

function App() {
  // --- State ---
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundMedia[]>([]);
  const [lyricStyle, setLyricStyle] = useState<LyricStyle>(DEFAULT_LYRIC_STYLE);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE_16_9);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Hidden video elements cache for background videos
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // --- Helpers ---

  // Handle Audio Upload
  const handleAudioUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioSrc(url);
    setAudioFile(file);
    if (audioRef.current) {
      audioRef.current.load();
    }
  };

  // Handle LRC
  const handleLrcUpload = (text: string) => {
    const lines = parseLrc(text);
    setLrcLines(lines);
  };

  // Handle Backgrounds
  const handleBackgroundUpload = (files: FileList) => {
    const newBackgrounds: BackgroundMedia[] = Array.from(files).map((file) => {
      const type = file.type.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE;
      const url = URL.createObjectURL(file);
      
      // If video, create a hidden video element to read metadata and for playback drawing
      if (type === MediaType.VIDEO) {
        if (!videoElementsRef.current.has(url)) {
            const v = document.createElement('video');
            v.src = url;
            v.muted = true;
            v.playsInline = true;
            v.load(); 
            videoElementsRef.current.set(url, v);
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        src: url,
        file,
        duration: type === MediaType.IMAGE ? 5 : 0, // Default 5s for images, 0 (auto) for videos
      };
    });
    setBackgrounds((prev) => [...prev, ...newBackgrounds]);
  };

  const removeBackground = (id: string) => {
    setBackgrounds(prev => {
        const bgToRemove = prev.find(b => b.id === id);
        
        // Only clean up video ref if no other background uses the same src (duplicates)
        if (bgToRemove && bgToRemove.type === MediaType.VIDEO) {
             const othersUsingSrc = prev.filter(b => b.id !== id && b.src === bgToRemove.src).length > 0;
             if (!othersUsingSrc) {
                 const v = videoElementsRef.current.get(bgToRemove.src);
                 if(v) {
                     v.pause();
                     v.src = '';
                     videoElementsRef.current.delete(bgToRemove.src);
                 }
             }
        }
        return prev.filter(b => b.id !== id);
    });
  };

  const duplicateBackground = (id: string) => {
      setBackgrounds(prev => {
          const original = prev.find(b => b.id === id);
          if (!original) return prev;
          
          const copy: BackgroundMedia = {
              ...original,
              id: Math.random().toString(36).substr(2, 9), // New ID
              // Src and file ref remain the same, which is fine as they point to the same blob
          };
          
          // Insert after the original
          const index = prev.indexOf(original);
          const newArr = [...prev];
          newArr.splice(index + 1, 0, copy);
          return newArr;
      });
  };

  const updateBackgroundDuration = (id: string, dur: number) => {
    setBackgrounds(prev => prev.map(b => b.id === id ? { ...b, duration: dur } : b));
  };

  // --- Canvas Logic ---

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 1. Clear & Background Fill
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Active Background
    // Logic: Calculate cumulative time to find which background to show
    if (backgrounds.length > 0) {
      let totalCycleDuration = 0;
      
      // Pre-calculate timeline
      const playlist = backgrounds.map(bg => {
         let duration = bg.duration;
         
         // If video and duration is 0, try to use natural duration
         if (bg.type === MediaType.VIDEO) {
             const v = videoElementsRef.current.get(bg.src);
             // Use natural duration only if user hasn't set a manual duration (0)
             if (duration === 0) {
                 if (v && v.duration && !isNaN(v.duration) && v.duration !== Infinity) {
                     duration = v.duration;
                 } else {
                     duration = 10; // Fallback while loading
                 }
             }
         }
         
         const start = totalCycleDuration;
         totalCycleDuration += duration;
         return { ...bg, start, end: totalCycleDuration, effectiveDuration: duration };
      });

      if (totalCycleDuration > 0) {
        const loopTime = currentTime % totalCycleDuration;
        const currentBg = playlist.find(item => loopTime >= item.start && loopTime < item.end) || playlist[0];

        if (currentBg) {
          if (currentBg.type === MediaType.IMAGE) {
            const img = new Image();
            img.src = currentBg.src;
            drawScaledMedia(ctx, img, canvas.width, canvas.height);
          } else if (currentBg.type === MediaType.VIDEO) {
             const v = videoElementsRef.current.get(currentBg.src);
             if (v) {
                 // Calculate local time within this clip [0, effectiveDuration]
                 let localTime = loopTime - currentBg.start;
                 
                 // Standard Loop Logic
                 const sourceDuration = (v.duration && v.duration !== Infinity) ? v.duration : 1;
                 const videoPointer = localTime % sourceDuration;

                 // Sync video element
                 if (Math.abs(v.currentTime - videoPointer) > 0.3) {
                     v.currentTime = videoPointer;
                 }
                 
                 // Manage play state
                 if (isPlaying && v.paused) v.play().catch(() => {});
                 if (!isPlaying && !v.paused) v.pause();
                 
                 drawScaledMedia(ctx, v, canvas.width, canvas.height);
             }
          }
        }
      }
    }

    // 3. Draw Overlay
    if (lyricStyle.bgOverlayOpacity > 0) {
        ctx.fillStyle = `rgba(0,0,0,${lyricStyle.bgOverlayOpacity})`;
        ctx.fillRect(0,0, canvas.width, canvas.height);
    }

    // 4. Draw Lyrics
    if (lrcLines.length > 0) {
      // Find active line
      const activeIndex = lrcLines.findIndex((line, i) => {
        const nextLine = lrcLines[i + 1];
        if (!nextLine) return currentTime >= line.time;
        return currentTime >= line.time && currentTime < nextLine.time;
      });

      // Define style
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = canvas.width / 2;
      const baseY = canvas.height * lyricStyle.positionY;
      
      // Draw active line
      if (activeIndex !== -1) {
          const activeLine = lrcLines[activeIndex];
          
          ctx.font = `bold ${lyricStyle.fontSize}px "${lyricStyle.fontFamily}", sans-serif`;
          ctx.shadowColor = lyricStyle.shadowColor;
          ctx.shadowBlur = lyricStyle.shadowBlur;
          ctx.fillStyle = lyricStyle.activeColor;
          ctx.fillText(activeLine.text, x, baseY);
          
          // Reset shadow for others
          ctx.shadowBlur = 0;

          // Draw next line (preview)
          if (activeIndex + 1 < lrcLines.length) {
              const nextLine = lrcLines[activeIndex + 1];
              ctx.font = `${lyricStyle.fontSize * 0.7}px "${lyricStyle.fontFamily}", sans-serif`;
              ctx.fillStyle = lyricStyle.fontColor;
              ctx.fillText(nextLine.text, x, baseY + lyricStyle.fontSize * 1.5);
          }
          
           // Draw prev line
          if (activeIndex - 1 >= 0) {
              const prevLine = lrcLines[activeIndex - 1];
              ctx.font = `${lyricStyle.fontSize * 0.7}px "${lyricStyle.fontFamily}", sans-serif`;
              ctx.fillStyle = lyricStyle.fontColor;
              ctx.fillText(prevLine.text, x, baseY - lyricStyle.fontSize * 1.5);
          }

      } else {
        // No active line found (maybe intro)
        if (lrcLines.length > 0 && currentTime < lrcLines[0].time) {
             ctx.font = `${lyricStyle.fontSize * 0.8}px "${lyricStyle.fontFamily}", sans-serif`;
             ctx.fillStyle = lyricStyle.fontColor;
             ctx.fillText(lrcLines[0].text, x, baseY + lyricStyle.fontSize * 1.5);
             ctx.fillText("...", x, baseY);
        }
      }
    }

  }, [backgrounds, currentTime, lrcLines, lyricStyle, isPlaying]);

  // Helper to draw image/video cover
  const drawScaledMedia = (ctx: CanvasRenderingContext2D, media: HTMLImageElement | HTMLVideoElement, cw: number, ch: number) => {
     let mw = 0, mh = 0;
     if (media instanceof HTMLVideoElement) {
         if (media.videoWidth === 0) return;
         mw = media.videoWidth;
         mh = media.videoHeight;
     } else {
         if (media.naturalWidth === 0) return; // Not loaded
         mw = media.naturalWidth;
         mh = media.naturalHeight;
     }

     const scale = Math.max(cw / mw, ch / mh);
     const x = (cw / 2) - (mw / 2) * scale;
     const y = (ch / 2) - (mh / 2) * scale;
     ctx.drawImage(media, x, y, mw * scale, mh * scale);
  };

  // --- Animation Loop ---
  useEffect(() => {
    const loop = () => {
      if (audioRef.current) {
        if (!audioRef.current.paused) {
           setCurrentTime(audioRef.current.currentTime);
        }
      }
      drawCanvas();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [drawCanvas]);

  // Handle Resize
  useEffect(() => {
    if (canvasRef.current) {
      const { width, height } = getResolution(aspectRatio);
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      drawCanvas(); // Force redraw on resize
    }
  }, [aspectRatio, drawCanvas]);


  // --- Controls ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        // Pause all background videos
        videoElementsRef.current.forEach(v => v.pause());
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // --- Recording Logic ---
  const startRecording = () => {
     if (!canvasRef.current || !audioRef.current) return;
     
     // Removed rewind to start to allow recording from current time
     
     if (!isPlaying) togglePlay();

     // Capture streams
     const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
     let combinedStream = canvasStream;
     
     // Try to get audio track
     try {
         // @ts-ignore - captureStream exists on modern Audio elements (experimental but widely supported)
         if (audioRef.current.captureStream) {
             // @ts-ignore
             const audioStream = audioRef.current.captureStream();
             const audioTrack = audioStream.getAudioTracks()[0];
             if (audioTrack) {
                 combinedStream.addTrack(audioTrack);
             }
         } else if ((audioRef.current as any).mozCaptureStream) {
             const audioStream = (audioRef.current as any).mozCaptureStream();
             const audioTrack = audioStream.getAudioTracks()[0];
              if (audioTrack) {
                 combinedStream.addTrack(audioTrack);
             }
         }
     } catch (e) {
         console.error("Could not capture audio stream", e);
         alert("Audio capture failed. Ensure you are using a modern browser (Chrome/Firefox).");
     }

     const recorder = new MediaRecorder(combinedStream, {
         mimeType: 'video/webm;codecs=vp9'
     });

     recorder.ondataavailable = (e) => {
         if (e.data.size > 0) chunksRef.current.push(e.data);
     };

     recorder.onstop = () => {
         const blob = new Blob(chunksRef.current, { type: 'video/webm' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `vibeflow_export_${Date.now()}.webm`;
         a.click();
         chunksRef.current = [];
     };

     recorder.start();
     mediaRecorderRef.current = recorder;
     setIsRecording(true);
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          // Pause playback when recording stops (UX choice: keeps user at end of segment)
          if (isPlaying) togglePlay(); 
      }
  };


  return (
    <div className="flex h-screen w-full bg-black text-white">
      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        src={audioSrc || undefined} 
        onEnded={() => {
            setIsPlaying(false);
            if (isRecording) stopRecording();
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <LyricEditor 
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={(lines) => setLrcLines(lines)}
        initialLines={lrcLines}
        audioRef={audioRef}
      />

      <ControlPanel 
        onAudioUpload={handleAudioUpload}
        onLrcUpload={handleLrcUpload}
        onBackgroundUpload={handleBackgroundUpload}
        backgrounds={backgrounds}
        onRemoveBackground={removeBackground}
        onDuplicateBackground={duplicateBackground}
        onUpdateBackgroundDuration={updateBackgroundDuration}
        lyricStyle={lyricStyle}
        setLyricStyle={setLyricStyle}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        audioFileName={audioFile?.name}
        onOpenLyricEditor={() => {
             if (!audioSrc) {
                 alert("Please upload audio first.");
                 return;
             }
             setIsPlaying(false);
             audioRef.current?.pause();
             setIsEditorOpen(true);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
         {/* Top Toolbar */}
         <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
            <div className="flex items-center gap-4">
               {!audioSrc && <span className="text-gray-500 text-sm flex items-center gap-2"><AlertCircle size={16}/> Start by uploading an MP3</span>}
            </div>
            
            <div className="flex items-center gap-4">
                {isRecording ? (
                    <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full text-sm font-bold animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full"></div> Stop Recording
                    </button>
                ) : (
                    <button 
                        onClick={startRecording} 
                        disabled={!audioSrc}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 rounded text-sm font-medium border border-gray-700"
                        title="Start recording from current position"
                    >
                        <Circle size={14} className="fill-red-500 text-red-500" /> Record & Export
                    </button>
                )}
            </div>
         </div>

         {/* Main Canvas Area */}
         <div className="flex-1 bg-gray-950 flex items-center justify-center p-8 overflow-hidden relative">
             <div 
               className="shadow-2xl border border-gray-800 relative"
               style={{ 
                   aspectRatio: aspectRatio.replace(':','/'), 
                   height: aspectRatio === AspectRatio.PORTRAIT_9_16 ? '90%' : 'auto',
                   width: aspectRatio !== AspectRatio.PORTRAIT_9_16 ? '90%' : 'auto',
                   maxWidth: '100%',
                   maxHeight: '100%'
               }}
             >
                <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-contain bg-black"
                />
             </div>
         </div>

         {/* Timeline Controls */}
         <div className="h-20 bg-gray-900 border-t border-gray-800 px-6 flex items-center gap-4">
            <button 
                onClick={togglePlay} 
                disabled={!audioSrc}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center disabled:bg-gray-700 disabled:cursor-not-allowed transition"
            >
                {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
            </button>
            
            <span className="text-xs font-mono text-gray-400 w-12 text-right">{formatTime(currentTime)}</span>
            
            <div className="flex-1 flex flex-col justify-center">
                 <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={handleSeek}
                    disabled={!audioSrc}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                 />
            </div>
            
            <span className="text-xs font-mono text-gray-400 w-12">{formatTime(duration)}</span>
         </div>
      </div>
    </div>
  );
}

export default App;
