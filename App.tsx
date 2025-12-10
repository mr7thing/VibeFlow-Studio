
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { LyricEditor } from './components/LyricEditor';
import { TitleEditor } from './components/TitleEditor';
import { BackgroundMedia, MediaType, LyricStyle, LrcLine, AspectRatio, LyricEffect, TitleConfig, TitleLayoutMode } from './types';
import { parseLrc, formatTime, getResolution } from './utils';
import { Play, Pause, Circle, Download, AlertCircle } from 'lucide-react';

const DEFAULT_LYRIC_STYLE: LyricStyle = {
  fontSize: 50,
  fontFamily: 'sans-serif',
  fontColor: '#ffffff80',
  activeColor: '#ffffff',
  shadowColor: '#000000',
  shadowBlur: 10,
  positionY: 0.8,
  positionX: 0.5,
  bgOverlayOpacity: 0.3,
  glowColor: '#00ccff',
  glowBlur: 0,
  animationEffect: LyricEffect.NONE,
};

const DEFAULT_TITLE_STYLE: LyricStyle = {
  fontSize: 80,
  fontFamily: 'sans-serif',
  fontColor: '#ffffff',
  activeColor: '#ffffff',
  shadowColor: '#000000',
  shadowBlur: 20,
  positionY: 0.5,
  positionX: 0.5,
  bgOverlayOpacity: 0.4,
  glowColor: '#ffaa00',
  glowBlur: 0,
  animationEffect: LyricEffect.FADE_UP,
};

const DEFAULT_TITLE_CONFIG: TitleConfig = {
    enabled: true,
    layoutMode: TitleLayoutMode.CENTERED,
    duration: 6,
    title: '',
    subtitle: '',
    artist: '',
    author: '',
    composer: '',
    producer: ''
};

function App() {
  // --- State ---
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundMedia[]>([]);
  
  const [lyricStyle, setLyricStyle] = useState<LyricStyle>(DEFAULT_LYRIC_STYLE);
  const [titleStyle, setTitleStyle] = useState<LyricStyle>(DEFAULT_TITLE_STYLE);
  const [titleConfig, setTitleConfig] = useState<TitleConfig>(DEFAULT_TITLE_CONFIG);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.LANDSCAPE_16_9);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTitleEditorOpen, setIsTitleEditorOpen] = useState(false);

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
    if (backgrounds.length > 0) {
      let totalCycleDuration = 0;
      
      const playlist = backgrounds.map(bg => {
         let duration = bg.duration;
         if (bg.type === MediaType.VIDEO) {
             const v = videoElementsRef.current.get(bg.src);
             if (duration === 0) {
                 if (v && v.duration && !isNaN(v.duration) && v.duration !== Infinity) {
                     duration = v.duration;
                 } else {
                     duration = 10;
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
                 let localTime = loopTime - currentBg.start;
                 const sourceDuration = (v.duration && v.duration !== Infinity) ? v.duration : 1;
                 const videoPointer = localTime % sourceDuration;

                 if (Math.abs(v.currentTime - videoPointer) > 0.3) {
                     v.currentTime = videoPointer;
                 }
                 
                 if (isPlaying && v.paused) v.play().catch(() => {});
                 if (!isPlaying && !v.paused) v.pause();
                 
                 drawScaledMedia(ctx, v, canvas.width, canvas.height);
             }
          }
        }
      }
    }

    // Common overlay helper
    const drawOverlay = (opacity: number) => {
        if (opacity > 0) {
            ctx.fillStyle = `rgba(0,0,0,${opacity})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }
    };
    
    // Determine active stage
    const isTitleActive = titleConfig.enabled && currentTime < titleConfig.duration;
    
    if (isTitleActive) {
        drawOverlay(titleStyle.bgOverlayOpacity);
    } else {
        drawOverlay(lyricStyle.bgOverlayOpacity);
    }


    // -- Helper for text drawing with Effects --
    const drawTextWithEffects = (
        text: string, 
        tx: number, 
        ty: number, 
        style: LyricStyle,
        color: string, 
        opacity: number = 1, 
        scale: number = 1, 
        blurAmount: number = 0,
        isVertical: boolean = false
    ) => {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity;
        
        if (blurAmount > 0) {
            ctx.filter = `blur(${blurAmount}px)`;
        }

        ctx.font = `bold ${style.fontSize}px "${style.fontFamily}", sans-serif`;

        // Pre-configure Shadow/Glow
        ctx.shadowColor = style.shadowColor;
        ctx.shadowBlur = style.shadowBlur;

        const drawPass = (fillColor: string, extraGlow: boolean) => {
             ctx.fillStyle = fillColor;
             if (extraGlow && style.glowBlur > 0) {
                 ctx.shadowColor = style.glowColor;
                 ctx.shadowBlur = style.glowBlur;
                 ctx.fillStyle = style.glowColor;
             }

             if (isVertical) {
                 const chars = text.split('');
                 let currentY = 0;
                 // Center horizontally relative to the tx line
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 
                 chars.forEach(char => {
                     // Check for ASCII/Rotated characters vs CJK
                     // Simple check: if ASCII, maybe rotate? Standard CJK is upright.
                     // For simplicity, we draw all upright centered.
                     ctx.fillText(char, 0, currentY);
                     currentY += style.fontSize * 1.1; // Line height
                 });
             } else {
                 ctx.fillText(text, 0, 0);
             }
        };

        // Pass 1: Optional Extra Glow (if configured)
        if (style.glowBlur > 0) {
            drawPass(style.glowColor, true);
        }

        // Pass 2: Main Text
        // Reset shadow for main text if it was changed for glow
        ctx.shadowColor = style.shadowColor;
        ctx.shadowBlur = style.shadowBlur;
        drawPass(color, false);

        ctx.restore();
    };

    // 4. Draw Title / Credits
    if (isTitleActive) {
        
        // --- Calculate Title Elements ---
        interface TitleElement {
            text: string;
            type: 'title' | 'subtitle' | 'credit' | 'label';
            delay: number; // Stagger delay in seconds
            fontSizeMult: number;
        }

        const elements: TitleElement[] = [];
        let staggerTimer = 0;
        const staggerStep = 0.4; // 400ms between items

        if (titleConfig.title) {
            elements.push({ text: titleConfig.title, type: 'title', delay: staggerTimer, fontSizeMult: 1.0 });
            staggerTimer += staggerStep;
        }
        if (titleConfig.subtitle) {
            elements.push({ text: titleConfig.subtitle, type: 'subtitle', delay: staggerTimer, fontSizeMult: 0.6 });
            staggerTimer += staggerStep;
        }
        if (titleConfig.artist) {
            elements.push({ text: titleConfig.artist, type: 'credit', delay: staggerTimer, fontSizeMult: 0.5 });
            staggerTimer += staggerStep;
        }

        // Combine tech credits
        const techCredits = [
            titleConfig.author ? `Lyrics: ${titleConfig.author}` : null,
            titleConfig.composer ? `Music: ${titleConfig.composer}` : null,
            titleConfig.producer ? `Prod: ${titleConfig.producer}` : null,
        ].filter(Boolean);

        techCredits.forEach(tc => {
            if (tc) {
                 elements.push({ text: tc, type: 'credit', delay: staggerTimer, fontSizeMult: 0.4 });
                 staggerTimer += 0.2; // faster for list
            }
        });

        // --- Render Based on Layout ---
        const cx = canvas.width * titleStyle.positionX;
        const cy = canvas.height * titleStyle.positionY;

        // Common Exit Logic
        const exitDuration = 1.0;
        const timeRemaining = titleConfig.duration - currentTime;
        let globalExitAlpha = 1;
        if (timeRemaining < exitDuration) {
            globalExitAlpha = Math.max(0, timeRemaining / exitDuration);
        }

        elements.forEach((el, index) => {
             // Calculate Local Time for Animation
             const elLocalTime = currentTime - el.delay;
             if (elLocalTime < 0) return; // Not started yet

             // Animation Progress (0 to 1 for entry)
             const entryDuration = 1.0;
             const progress = Math.min(1, elLocalTime / entryDuration);
             const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

             const currentFontSize = titleStyle.fontSize * el.fontSizeMult;
             const effectiveStyle = { ...titleStyle, fontSize: currentFontSize };

             // --- Calculate Position ---
             let x = cx;
             let y = cy;

             if (titleConfig.layoutMode === TitleLayoutMode.CENTERED) {
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 // Simple vertical stacking
                 // Calculate offset based on index and font sizes approximately
                 // This is a rough estimation, for perfect layout we'd measure.
                 const totalHeightEstimate = elements.reduce((acc, e) => acc + (titleStyle.fontSize * e.fontSizeMult * 1.5), 0);
                 const startY = cy - (totalHeightEstimate / 2);
                 
                 let yOffset = 0;
                 for(let i=0; i<index; i++) {
                     yOffset += titleStyle.fontSize * elements[i].fontSizeMult * 1.5;
                 }
                 y = startY + yOffset + (titleStyle.fontSize * el.fontSizeMult / 2); // Center of line

             } else if (titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT) {
                 // Right to left stacking
                 const totalWidthEstimate = elements.reduce((acc, e) => acc + (titleStyle.fontSize * e.fontSizeMult * 1.5), 0);
                 const startX = cx + (totalWidthEstimate / 2);

                 let xOffset = 0;
                 for(let i=0; i<index; i++) {
                     xOffset += titleStyle.fontSize * elements[i].fontSizeMult * 1.5;
                 }
                 x = startX - xOffset - (titleStyle.fontSize * el.fontSizeMult / 2);
                 y = cy - (currentFontSize * el.text.length / 2); // Start Y roughly centered vertically? No, vertical text logic draws down.
                 // Actually vertical drawing needs top anchor usually to center block
                 y = cy - (currentFontSize * el.text.length * 1.1 / 2);

             } else if (titleConfig.layoutMode === TitleLayoutMode.CINEMATIC) {
                 // Title Huge Center, Subtitle below, Credits at bottom spread
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';

                 if (el.type === 'title') {
                     y = cy - 40;
                 } else if (el.type === 'subtitle') {
                     y = cy + currentFontSize;
                 } else {
                     // Push credits to bottom
                     y = canvas.height * 0.85 + (index - 2) * currentFontSize * 1.5;
                 }
             }

             // --- Apply Effects ---
             let alpha = globalExitAlpha;
             let scale = 1;
             let yAnimOffset = 0;

             if (titleStyle.animationEffect === LyricEffect.FADE_UP) {
                 alpha *= ease;
                 yAnimOffset = (1 - ease) * 50;
                 if (titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT) {
                      yAnimOffset = 0; // Don't slide vertical text up, maybe slide opacity only or slide left?
                      // Let's slide left for vertical
                      x += (1-ease) * 30;
                 } else {
                     y += yAnimOffset;
                 }
             } else if (titleStyle.animationEffect === LyricEffect.TYPEWRITER) {
                 // Typewriter Logic
                 const charCount = el.text.length;
                 const typeDuration = 1.5; 
                 const visibleChars = Math.floor(charCount * Math.min(1, elLocalTime / typeDuration));
                 // Mutate text for display
                 el.text = el.text.substring(0, visibleChars);
             } else if (titleStyle.animationEffect === LyricEffect.SCATTER) {
                 // Entrance scatter? Or simple fade
                 alpha *= ease;
                 scale = 0.5 + ease * 0.5;
             } else {
                 alpha *= ease;
             }

             drawTextWithEffects(
                 el.text, 
                 x, 
                 y, 
                 effectiveStyle, 
                 titleStyle.activeColor, 
                 alpha, 
                 scale, 
                 0, 
                 titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT
             );
        });

    } 
    // 5. Draw Lyrics
    else if (lrcLines.length > 0) {
      const activeIndex = lrcLines.findIndex((line, i) => {
        const nextLine = lrcLines[i + 1];
        if (!nextLine) return currentTime >= line.time;
        return currentTime >= line.time && currentTime < nextLine.time;
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = canvas.width * lyricStyle.positionX;
      const baseY = canvas.height * lyricStyle.positionY;

      // -- Draw Active Line --
      if (activeIndex !== -1) {
          const line = lrcLines[activeIndex];
          const nextLineTime = lrcLines[activeIndex + 1]?.time || (line.time + 5);
          const duration = nextLineTime - line.time;
          const progress = Math.max(0, Math.min(1, (currentTime - line.time) / duration));

          // Effect Logic
          if (lyricStyle.animationEffect === LyricEffect.FADE_UP) {
              const entryDuration = 0.5; // seconds
              const entryProgress = Math.min(1, (currentTime - line.time) / entryDuration);
              const ease = 1 - Math.pow(1 - entryProgress, 3); // easeOutCubic
              
              const yOffset = (1 - ease) * 30; // Slide up 30px
              const opacity = ease;
              drawTextWithEffects(line.text, x, baseY + yOffset, lyricStyle, lyricStyle.activeColor, opacity);

          } else if (lyricStyle.animationEffect === LyricEffect.TYPEWRITER) {
              const charCount = line.text.length;
              const typeDuration = Math.min(duration * 0.8, 2); 
              const visibleChars = Math.floor(charCount * Math.min(1, (currentTime - line.time) / typeDuration));
              const textToShow = line.text.substring(0, visibleChars);
              drawTextWithEffects(textToShow, x, baseY, lyricStyle, lyricStyle.activeColor);

          } else if (lyricStyle.animationEffect === LyricEffect.KARAOKE) {
              // 1. Draw Inactive base
              drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.fontColor);
              
              // 2. Draw Active Overlay with Clip
              ctx.save();
              ctx.beginPath();
              ctx.font = `bold ${lyricStyle.fontSize}px "${lyricStyle.fontFamily}", sans-serif`;
              const textWidth = ctx.measureText(line.text).width;
              
              const clipWidth = textWidth * progress;
              const startX = x - (textWidth / 2);
              
              ctx.rect(startX, baseY - lyricStyle.fontSize, clipWidth, lyricStyle.fontSize * 2);
              ctx.clip();
              
              drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.activeColor);
              ctx.restore();

          } else if (lyricStyle.animationEffect === LyricEffect.BREATHING) {
              const pulse = (Math.sin(currentTime * 3) + 1) / 2; // 0 to 1
              const scale = 1 + (pulse * 0.05); // 1.0 to 1.05
              const styleCopy = {...lyricStyle};
              styleCopy.glowBlur = lyricStyle.glowBlur + (pulse * 10);
              drawTextWithEffects(line.text, x, baseY, styleCopy, lyricStyle.activeColor, 1, scale);

          } else if (lyricStyle.animationEffect === LyricEffect.SCATTER) {
              const scatterStart = 0.8;
              if (progress < scatterStart) {
                   drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.activeColor);
              } else {
                   const scatterProgress = (progress - scatterStart) / (1 - scatterStart);
                   const scale = 1 + scatterProgress * 2;
                   const opacity = 1 - scatterProgress;
                   const blur = scatterProgress * 10;
                   drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.activeColor, opacity, scale, blur);
              }

          } else {
              drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.activeColor);
          }

          // Draw next line (preview)
          if (activeIndex + 1 < lrcLines.length) {
              const nextLine = lrcLines[activeIndex + 1];
              const previewStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.7 };
              drawTextWithEffects(nextLine.text, x, baseY + lyricStyle.fontSize * 1.5, previewStyle, lyricStyle.fontColor);
          }
          
           // Draw prev line
          if (activeIndex - 1 >= 0) {
              const prevLine = lrcLines[activeIndex - 1];
              const prevStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.7 };
              drawTextWithEffects(prevLine.text, x, baseY - lyricStyle.fontSize * 1.5, prevStyle, lyricStyle.fontColor);
          }

      } else {
        // No active line found (intro)
        if (lrcLines.length > 0 && currentTime < lrcLines[0].time) {
             const previewStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.8 };
             drawTextWithEffects(lrcLines[0].text, x, baseY + lyricStyle.fontSize * 1.5, previewStyle, lyricStyle.fontColor);
             drawTextWithEffects("...", x, baseY, lyricStyle, lyricStyle.fontColor);
        }
      }
    }

  }, [backgrounds, currentTime, lrcLines, lyricStyle, titleStyle, titleConfig, isPlaying]);

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
     
     if (!isPlaying) togglePlay();

     // Capture streams
     const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
     let combinedStream = canvasStream;
     
     // Try to get audio track
     try {
         // @ts-ignore
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

      <TitleEditor 
        isOpen={isTitleEditorOpen}
        onClose={() => setIsTitleEditorOpen(false)}
        config={titleConfig}
        onSave={setTitleConfig}
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
        
        titleStyle={titleStyle}
        setTitleStyle={setTitleStyle}

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
        onOpenTitleEditor={() => setIsTitleEditorOpen(true)}
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
