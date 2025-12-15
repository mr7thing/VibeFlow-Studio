
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { LyricEditor } from './components/LyricEditor';
import { TitleEditor } from './components/TitleEditor';
import { ProjectManager } from './components/ProjectManager';
import { BackgroundMedia, MediaType, LyricStyle, LrcLine, AspectRatio, LyricEffect, TitleConfig, TitleLayoutMode, SavedProjectData, TransitionEffect, VisualizerConfig, OverlayType, PostProcessType } from './types';
import { parseLrc, formatTime, getResolution } from './utils';
import { saveProjectToDB, loadProjectFromDB } from './utils/db';
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

const DEFAULT_VISUALIZER_CONFIG: VisualizerConfig = {
    overlay: {
        type: OverlayType.NONE,
        color: '#ffffff',
        opacity: 0.8,
        sensitivity: 1.5,
        barCount: 64
    },
    postProcess: {
        type: PostProcessType.NONE,
        opacity: 0.8,
        sensitivity: 1.5
    }
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
  
  // Transition Settings
  const [transitionEffect, setTransitionEffect] = useState<TransitionEffect>(TransitionEffect.CROSSFADE);
  const [transitionDuration, setTransitionDuration] = useState<number>(1.5);

  // Visualizer Settings
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>(DEFAULT_VISUALIZER_CONFIG);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTitleEditorOpen, setIsTitleEditorOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // Re-introduce for Post-FX
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Audio Analysis Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const timeDomainDataRef = useRef<Uint8Array | null>(null);
  
  // Visualizer Refs
  const particlesRef = useRef<{x: number, y: number, z: number}[]>([]);
  const tunnelRef = useRef({ zOffset: 0, rotation: 0 }); // New ref for tunnel state
  
  // Hidden video elements cache for background videos
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());


  // --- Helpers ---

  // Handle Audio Upload
  const handleAudioUpload = (file: File) => {
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    const url = URL.createObjectURL(file);
    setAudioSrc(url);
    setAudioFile(file);
    if (audioRef.current) {
      audioRef.current.load();
    }
  };

  // Setup Audio Context (Call this on user interaction like Play)
  const setupAudioContext = () => {
      if (!audioRef.current) return;
      if (audioContextRef.current) {
           if(audioContextRef.current.state === 'suspended') {
               audioContextRef.current.resume();
           }
           return; // Already setup
      }

      try {
          // Initialize Context
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          // Use smaller FFT for cleaner bar visualization, or large for waveform
          analyser.fftSize = 2048; 
          
          // Connect source
          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyser);
          analyser.connect(ctx.destination); // Connect back to speakers

          audioContextRef.current = ctx;
          analyserRef.current = analyser;
          sourceNodeRef.current = source;
          frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
          timeDomainDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
          console.error("Audio Context Setup Error:", e);
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
              id: Math.random().toString(36).substr(2, 9), 
              // Src and file ref remain the same, which is fine as they point to the same blob
          };
          return [...prev, copy];
      });
  };

  const moveBackground = (id: string, direction: 'up' | 'down') => {
      setBackgrounds(prev => {
          const index = prev.findIndex(b => b.id === id);
          if (index === -1) return prev;
          if (direction === 'up' && index === 0) return prev;
          if (direction === 'down' && index === prev.length - 1) return prev;
          const newArr = [...prev];
          const swapIndex = direction === 'up' ? index - 1 : index + 1;
          [newArr[index], newArr[swapIndex]] = [newArr[swapIndex], newArr[index]];
          return newArr;
      });
  };

  const updateBackgroundDuration = (id: string, dur: number) => {
    setBackgrounds(prev => prev.map(b => b.id === id ? { ...b, duration: dur } : b));
  };

  // --- Project Persistence ---
  
  const handleSaveProject = async (name: string) => {
      const projectId = Date.now().toString(); // Simple ID
      const projectData: SavedProjectData = {
          id: projectId,
          name,
          updatedAt: Date.now(),
          lyricStyle,
          titleStyle,
          titleConfig,
          aspectRatio,
          transitionEffect,
          transitionDuration,
          visualizerConfig,
          lrcLines,
          audioFileName: audioFile?.name,
          backgrounds: backgrounds.map(bg => ({
              id: bg.id,
              type: bg.type,
              duration: bg.duration,
              fileName: bg.file.name
          }))
      };
      const bgBlobs = backgrounds.map(bg => ({ id: bg.id, blob: bg.file }));
      await saveProjectToDB(projectData, audioFile, bgBlobs);
  };

  const handleLoadProject = async (id: string) => {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      if(audioSrc) URL.revokeObjectURL(audioSrc);
      backgrounds.forEach(bg => URL.revokeObjectURL(bg.src));
      
      const { data, audioBlob, backgroundBlobs } = await loadProjectFromDB(id);

      setLyricStyle(data.lyricStyle);
      setTitleStyle(data.titleStyle);
      setTitleConfig(data.titleConfig);
      setAspectRatio(data.aspectRatio);
      setLrcLines(data.lrcLines);
      
      if(data.transitionEffect) setTransitionEffect(data.transitionEffect);
      if(data.transitionDuration) setTransitionDuration(data.transitionDuration);
      
      // Handle legacy project structure or load new config
      if (data.visualizerConfig) {
          const vizConfig = data.visualizerConfig as any;
          if ('overlay' in vizConfig) {
              setVisualizerConfig(vizConfig);
          } else {
              // Migration for projects saved before split
              setVisualizerConfig({
                  overlay: { ...DEFAULT_VISUALIZER_CONFIG.overlay, ...vizConfig }, // Best effort map
                  postProcess: DEFAULT_VISUALIZER_CONFIG.postProcess
              });
          }
      } else {
          setVisualizerConfig(DEFAULT_VISUALIZER_CONFIG);
      }

      if (audioBlob) {
          const url = URL.createObjectURL(audioBlob);
          setAudioSrc(url);
          setAudioFile(new File([audioBlob], data.audioFileName || 'audio.mp3', { type: audioBlob.type }));
      } else {
          setAudioSrc(null);
          setAudioFile(null);
      }

      const restoredBackgrounds: BackgroundMedia[] = [];
      data.backgrounds.forEach(bgMeta => {
          const blob = backgroundBlobs.get(bgMeta.id);
          if (blob) {
              const url = URL.createObjectURL(blob);
              const file = new File([blob], bgMeta.fileName, { type: blob.type });
              if (bgMeta.type === MediaType.VIDEO) {
                 if (!videoElementsRef.current.has(url)) {
                    const v = document.createElement('video');
                    v.src = url;
                    v.muted = true;
                    v.playsInline = true;
                    v.load(); 
                    videoElementsRef.current.set(url, v);
                }
              }
              restoredBackgrounds.push({
                  id: bgMeta.id,
                  type: bgMeta.type,
                  src: url,
                  file,
                  duration: bgMeta.duration
              });
          }
      });
      setBackgrounds(restoredBackgrounds);
  };

  const handleExportConfig = () => {
      const config = {
          lyricStyle,
          titleStyle,
          titleConfig,
          lrcLines,
          aspectRatio,
          transitionEffect,
          transitionDuration,
          visualizerConfig,
          _meta: {
              audioName: audioFile?.name,
              backgroundCount: backgrounds.length,
              exportedAt: new Date().toISOString()
          }
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibeflow_config_${Date.now()}.json`;
      a.click();
  };

  // --- Canvas Logic ---

  const drawScaledMedia = useCallback((ctx: CanvasRenderingContext2D, media: HTMLImageElement | HTMLVideoElement, cw: number, ch: number, scaleFactor: number = 1, opacity: number = 1) => {
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

     ctx.globalAlpha = opacity;
     
     // Calculate 'cover' fit
     const ratio = Math.max(cw / mw, ch / mh) * scaleFactor;
     const dw = mw * ratio;
     const dh = mh * ratio;
     const x = (cw - dw) / 2;
     const y = (ch - dh) / 2;

     ctx.drawImage(media, x, y, dw, dh);
     ctx.globalAlpha = 1.0; // Reset
  }, []);

  // 1. Geometric Visualizers (Overlay)
  const drawGeometricOverlay = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, energy: { bass: number, mid: number, treble: number }) => {
     const { type, sensitivity, opacity, color } = visualizerConfig.overlay;
     const cx = width / 2;
     const cy = height / 2;
     
     if (type === OverlayType.NONE) return;

     ctx.save();
     
     // Use screen or overlay blend mode for that "glowing" look over backgrounds
     ctx.globalCompositeOperation = 'source-over'; 
     ctx.globalAlpha = opacity;
     ctx.fillStyle = color;
     ctx.strokeStyle = color;

     if (type === OverlayType.CIRCULAR_SPECTRUM) {
         if (frequencyDataRef.current) {
             const data = frequencyDataRef.current;
             const bars = 180; 
             const step = Math.floor(800 / bars); 
             
             const baseRadius = Math.min(width, height) * 0.2 + (energy.bass * 0.1 * sensitivity);

             ctx.beginPath();
             for (let i = 0; i < bars; i++) {
                 let val = 0;
                 for(let j=0; j<step; j++) val += data[(i * step) + j];
                 val /= step;
                 
                 const barHeight = Math.max(2, (val * sensitivity * 0.8));
                 const rad = (i / bars) * (Math.PI * 2);
                 const x1 = cx + Math.cos(rad) * baseRadius;
                 const y1 = cy + Math.sin(rad) * baseRadius;
                 const x2 = cx + Math.cos(rad) * (baseRadius + barHeight);
                 const y2 = cy + Math.sin(rad) * (baseRadius + barHeight);
                 
                 ctx.moveTo(x1, y1);
                 ctx.lineTo(x2, y2);
             }
             ctx.lineWidth = 2;
             ctx.lineCap = 'round';
             ctx.stroke();

             ctx.beginPath();
             ctx.arc(cx, cy, baseRadius - 5, 0, Math.PI * 2);
             ctx.fillStyle = `${color}40`;
             ctx.fill();
         }
     }
     else if (type === OverlayType.WAVE_RING) {
         if (timeDomainDataRef.current) {
             const data = timeDomainDataRef.current;
             const slices = 360; 
             const step = Math.floor(data.length / slices);
             const radius = Math.min(width, height) * 0.25;

             ctx.beginPath();
             for(let i=0; i < slices; i++) {
                 const v = (data[i * step] - 128) / 128.0; 
                 const r = radius + (v * 100 * sensitivity);
                 const rad = (i / slices) * (Math.PI * 2);
                 
                 const x = cx + Math.cos(rad) * r;
                 const y = cy + Math.sin(rad) * r;

                 if (i === 0) ctx.moveTo(x, y);
                 else ctx.lineTo(x, y);
             }
             ctx.closePath();
             ctx.lineWidth = 3;
             ctx.stroke();
             ctx.fillStyle = `${color}20`;
             ctx.fill();
         }
     }
     else if (type === OverlayType.STAR_FIELD) {
         if (particlesRef.current.length < 200) {
             for(let i=0; i<200; i++) {
                 particlesRef.current.push({
                     x: (Math.random() - 0.5) * width * 2,
                     y: (Math.random() - 0.5) * height * 2,
                     z: Math.random() * width
                 });
             }
         }
         
         const speed = 5 + (energy.mid * 0.5 * sensitivity);
         
         particlesRef.current.forEach(p => {
             p.z -= speed;
             if (p.z <= 0) {
                 p.z = width;
                 p.x = (Math.random() - 0.5) * width * 2;
                 p.y = (Math.random() - 0.5) * height * 2;
             }
             const k = 128.0 / p.z;
             const px = cx + p.x * k;
             const py = cy + p.y * k;
             
             if (px >= 0 && px <= width && py >= 0 && py <= height) {
                 const size = (1 - p.z / width) * 4;
                 const alpha = (1 - p.z / width);
                 ctx.globalAlpha = alpha * opacity;
                 ctx.fillStyle = color;
                 ctx.beginPath();
                 ctx.arc(px, py, size, 0, Math.PI*2);
                 ctx.fill();
             }
         });
     }
     else if (type === OverlayType.PARTICLE_TUNNEL) {
        // Geometric Hexagon Tunnel
        const maxDepth = 1000;
        const numRings = 20;
        const ringSpacing = maxDepth / numRings;
        const bassKick = (energy.bass / 255);
        const rotationSpeed = 0.005 + ((energy.mid / 255) * 0.02 * sensitivity);
        const forwardSpeed = 2 + (bassKick * 10 * sensitivity);

        // Update state
        tunnelRef.current.zOffset = (tunnelRef.current.zOffset + forwardSpeed) % ringSpacing;
        tunnelRef.current.rotation += rotationSpeed;

        const sides = 6; // Hexagon
        
        ctx.lineWidth = 2 * sensitivity;
        ctx.lineCap = 'round';

        // Draw Rings
        for (let i = 0; i < numRings; i++) {
            const z = maxDepth - (i * ringSpacing) - tunnelRef.current.zOffset;
            
            // Perspective Projection
            const fov = 300;
            const scale = fov / (fov + z); // Standard 3D projection
            if (scale <= 0) continue;

            const alpha = (z / maxDepth); // Fade out as it gets deeper? Or fade out as it gets closer? 
            // Let's fade out at the back (z=1000) and full opacity near camera (z=0)
            ctx.globalAlpha = (1 - (z/maxDepth)) * opacity;
            
            // Calculate radius based on z (perspective) but also Audio
            const baseRadius = Math.min(width, height) * 0.8;
            const r = baseRadius * scale * (1 + (bassKick * 0.2));

            const rotation = tunnelRef.current.rotation + (i * 0.1); // Twist effect

            ctx.beginPath();
            for (let j = 0; j <= sides; j++) {
                const theta = (j / sides) * Math.PI * 2 + rotation;
                const px = cx + Math.cos(theta) * r;
                const py = cy + Math.sin(theta) * r;
                if (j === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Connect this ring to the next one (wireframe mesh)
            if (i > 0) {
                 const prevZ = maxDepth - ((i-1) * ringSpacing) - tunnelRef.current.zOffset;
                 const prevScale = fov / (fov + prevZ);
                 const prevR = baseRadius * prevScale * (1 + (bassKick * 0.2));
                 const prevRotation = tunnelRef.current.rotation + ((i-1) * 0.1);

                 // Draw connections
                 ctx.lineWidth = 1;
                 ctx.globalAlpha = (1 - (z/maxDepth)) * 0.3 * opacity; // Fainter lines for connections
                 for (let j = 0; j < sides; j++) {
                    const theta = (j / sides) * Math.PI * 2 + rotation;
                    const prevTheta = (j / sides) * Math.PI * 2 + prevRotation;
                    
                    const px = cx + Math.cos(theta) * r;
                    const py = cy + Math.sin(theta) * r;
                    
                    const ppx = cx + Math.cos(prevTheta) * prevR;
                    const ppy = cy + Math.sin(prevTheta) * prevR;
                    
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(ppx, ppy);
                    ctx.stroke();
                 }
                 ctx.lineWidth = 2 * sensitivity; // Reset for main rings
            }
        }
     }
     else if (type === OverlayType.CLASSIC_BARS) {
         if (frequencyDataRef.current) {
             const data = frequencyDataRef.current;
             const barCount = 64;
             const step = Math.floor(1024 / barCount);
             const barW = width / barCount;
             
             for(let i=0; i<barCount; i++) {
                 const val = data[i * step];
                 const h = (val / 255) * (height * 0.4) * sensitivity;
                 const x = i * barW;
                 const y = height - h;
                 
                 ctx.fillStyle = color;
                 ctx.fillRect(x + 1, y, barW - 2, h);
                 ctx.fillStyle = `${color}30`;
                 ctx.fillRect(x + 1, height, barW - 2, h * 0.5);
             }
         }
     }

     ctx.restore();
  }, [visualizerConfig.overlay]);

  // 2. Post-Processing Visualizers (Offscreen -> Main)
  const applyPostProcessing = useCallback((ctx: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, width: number, height: number, energy: { bass: number, mid: number, treble: number }) => {
    const { type, sensitivity, opacity } = visualizerConfig.postProcess;
    
    if (type === PostProcessType.NONE) {
        ctx.drawImage(sourceCanvas, 0, 0);
        return;
    }

    const time = performance.now() / 1000;

    if (type === PostProcessType.LIQUID_WARP) {
        const amp = (energy.bass / 255) * 50 * sensitivity;
        const freq = 0.02;
        const sliceHeight = 5; 
        
        ctx.save();
        for (let y = 0; y < height; y += sliceHeight) {
            const xOffset = Math.sin(y * freq + time * 3) * amp * opacity;
            const scaleX = 1 + (Math.sin(y * 0.01 + time) * 0.05 * amp/10);
            ctx.drawImage(sourceCanvas, 0, y, width, sliceHeight, xOffset - (width*(scaleX-1)/2), y, width * scaleX, sliceHeight);
        }
        ctx.restore();
    } 
    else if (type === PostProcessType.VHS_GLITCH) {
        const bassKick = (energy.bass / 255) > 0.6 ? (energy.bass/255) : 0;
        const shift = (5 + bassKick * 50 * sensitivity) * opacity;
        
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,width,height);
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(sourceCanvas, 0, 0);

        if (opacity > 0.1) {
           ctx.globalCompositeOperation = 'screen';
           ctx.globalAlpha = 0.5 * opacity;
           ctx.drawImage(sourceCanvas, shift, 0);
           ctx.globalAlpha = 0.5 * opacity;
           ctx.drawImage(sourceCanvas, -shift, 0);
        }

        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for(let y=0; y<height; y+=4) {
            ctx.fillRect(0, y, width, 1);
        }

        if (bassKick > 0.8) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = `rgba(255,255,255,${bassKick * 0.2})`;
            ctx.fillRect(0, Math.random()*height, width, height/10);
        }
        ctx.restore();
    }
    else if (type === PostProcessType.KALEIDOSCOPE) {
        const halfW = width / 2;
        const halfH = height / 2;
        
        ctx.save();
        ctx.drawImage(sourceCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sourceCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();

        ctx.save();
        ctx.translate(0, height);
        ctx.scale(1, -1);
        ctx.drawImage(sourceCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();

        ctx.save();
        ctx.translate(width, height);
        ctx.scale(-1, -1);
        ctx.drawImage(sourceCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();
        
        const rot = (energy.mid / 255) * Math.PI * sensitivity * opacity;
        if (rot > 0.1) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.3;
            ctx.translate(halfW, halfH);
            ctx.rotate(time + rot);
            ctx.drawImage(sourceCanvas, -halfW/2, -halfH/2, halfW, halfH);
        }
        ctx.restore();
    }
    else if (type === PostProcessType.RGB_PULSE) {
        const beat = energy.bass / 255;
        const zoom = 1 + (beat * 0.1 * sensitivity * opacity);
        const dw = width * zoom;
        const dh = height * zoom;
        const dx = (width - dw) / 2;
        const dy = (height - dh) / 2;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,width,height);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 1;
        ctx.drawImage(sourceCanvas, dx - (20 * beat * opacity), dy, dw, dh);
        
        ctx.globalCompositeOperation = 'lighten';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(sourceCanvas, dx + (20 * beat * opacity), dy, dw, dh);
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sourceCanvas, dx, dy, dw, dh);
        ctx.restore();
    }
    else if (type === PostProcessType.MIRROR_ZOOM) {
        const zoom = 1 + (Math.sin(time) * 0.05) + ((energy.bass/255) * 0.2 * sensitivity * opacity);
        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.scale(zoom, zoom);
        ctx.translate(-width/2, -height/2);

        ctx.drawImage(sourceCanvas, 0, 0, width, height/2, 0, 0, width, height/2);
        
        ctx.save();
        ctx.translate(0, height);
        ctx.scale(1, -1);
        ctx.drawImage(sourceCanvas, 0, 0, width, height/2, 0, 0, width, height/2);
        ctx.restore();
        ctx.restore();
    }
    else {
        ctx.drawImage(sourceCanvas, 0, 0);
    }

 }, [visualizerConfig.postProcess]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // --- Audio Analysis ---
    let bass = 0, mid = 0, treble = 0;
    if (analyserRef.current && frequencyDataRef.current && timeDomainDataRef.current) {
        analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
        analyserRef.current.getByteTimeDomainData(timeDomainDataRef.current);
        const data = frequencyDataRef.current;
        const len = data.length;
        
        for(let i=0; i<4; i++) bass += data[i];
        bass /= 4;
        for(let i=4; i<32; i++) mid += data[i];
        mid /= 28;
        for(let i=32; i<128 && i < len; i++) treble += data[i];
        treble /= 96;
    }
    const audioEnergy = { bass, mid, treble };

    // --- RENDER PIPELINE ---
    
    // We always use offscreen canvas now to support post-process potential
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
    }
    const off = offscreenCanvasRef.current;
    if (off.width !== canvas.width || off.height !== canvas.height) {
        off.width = canvas.width;
        off.height = canvas.height;
    }
    const offCtx = off.getContext('2d');
    if (!offCtx) return;

    // --- 1. DRAW BACKGROUND (To offCtx) ---
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, off.width, off.height);

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
        const currentIndex = playlist.findIndex(item => loopTime >= item.start && loopTime < item.end);
        
        if (currentIndex !== -1) {
          const currentItem = playlist[currentIndex];
          const timeRemaining = currentItem.end - loopTime;
          const inTransition = timeRemaining <= transitionDuration && backgrounds.length > 1;
          
          const renderItem = (item: typeof playlist[0], alpha: number = 1, scale: number = 1) => {
               offCtx.save();
               if (item.type === MediaType.IMAGE) {
                    const img = new Image();
                    img.src = item.src;
                    drawScaledMedia(offCtx, img, off.width, off.height, scale, alpha);
               } else if (item.type === MediaType.VIDEO) {
                    const v = videoElementsRef.current.get(item.src);
                    if (v) {
                         let videoTime = 0;
                         if (item === currentItem) {
                             videoTime = loopTime - item.start;
                         } else {
                             videoTime = (transitionDuration - timeRemaining); 
                         }
                         const sourceDuration = (v.duration && v.duration !== Infinity) ? v.duration : 1;
                         const videoPointer = videoTime % sourceDuration;
                         if (Math.abs(v.currentTime - videoPointer) > 0.3) {
                             v.currentTime = videoPointer;
                         }
                         if (isPlaying && v.paused) v.play().catch(() => {});
                         if (!isPlaying && !v.paused) v.pause();
                         drawScaledMedia(offCtx, v, off.width, off.height, scale, alpha);
                    }
               }
               offCtx.restore();
          };

          if (!inTransition || transitionEffect === TransitionEffect.NONE) {
              renderItem(currentItem);
          } else {
              const nextIndex = (currentIndex + 1) % playlist.length;
              const nextItem = playlist[nextIndex];
              const progress = 1 - (timeRemaining / transitionDuration);

              if (transitionEffect === TransitionEffect.CROSSFADE) {
                  renderItem(currentItem, 1);
                  renderItem(nextItem, progress);
              } 
              else if (transitionEffect === TransitionEffect.FLASH_BLACK) {
                  if (progress < 0.5) {
                      renderItem(currentItem, 1 - (progress * 2));
                  } else {
                      renderItem(nextItem, (progress - 0.5) * 2);
                  }
              }
              else if (transitionEffect === TransitionEffect.ZOOM_OUT) {
                  const scale = 1 + (progress * 0.2);
                  renderItem(currentItem, 1 - progress, scale);
                  renderItem(nextItem, progress);
              }
              else if (transitionEffect === TransitionEffect.SHAKE) {
                  const shakeAmt = 10 * (1-progress);
                  offCtx.save();
                  offCtx.translate((Math.random()-0.5)*shakeAmt, (Math.random()-0.5)*shakeAmt);
                  renderItem(currentItem, 1);
                  offCtx.restore();
                  offCtx.save();
                  offCtx.globalCompositeOperation = 'lighter';
                  renderItem(nextItem, progress);
                  offCtx.restore();
              }
          }
        }
      }
    }


    // --- 2. APPLY POST PROCESS (Offscreen -> Main) ---
    // Clears Main Canvas inside logic
    applyPostProcessing(ctx, off, canvas.width, canvas.height, audioEnergy);


    // --- 3. DRAW GEOMETRIC OVERLAY (On Main) ---
    drawGeometricOverlay(ctx, canvas.width, canvas.height, audioEnergy);


    // --- 4. DRAW UI/LYRICS ON MAIN CANVAS ---
    const drawOverlay = (opacity: number) => {
        if (opacity > 0) {
            ctx.fillStyle = `rgba(0,0,0,${opacity})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }
    };
    
    const isTitleActive = titleConfig.enabled && currentTime < titleConfig.duration;
    
    if (isTitleActive) {
        drawOverlay(titleStyle.bgOverlayOpacity);
    } else {
        drawOverlay(lyricStyle.bgOverlayOpacity);
    }

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
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 
                 chars.forEach(char => {
                     ctx.fillText(char, 0, currentY);
                     currentY += style.fontSize * 1.1; 
                 });
             } else {
                 ctx.fillText(text, 0, 0);
             }
        };

        if (style.glowBlur > 0) {
            drawPass(style.glowColor, true);
        }
        ctx.shadowColor = style.shadowColor;
        ctx.shadowBlur = style.shadowBlur;
        drawPass(color, false);
        ctx.restore();
    };

    if (isTitleActive) {
        // Title Logic ...
        interface TitleElement {
            text: string;
            type: 'title' | 'subtitle' | 'credit' | 'label';
            delay: number;
            fontSizeMult: number;
        }

        const elements: TitleElement[] = [];
        let staggerTimer = 0;
        const staggerStep = 0.4; 

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

        const techCredits = [
            titleConfig.author ? `Lyrics: ${titleConfig.author}` : null,
            titleConfig.composer ? `Music: ${titleConfig.composer}` : null,
            titleConfig.producer ? `Prod: ${titleConfig.producer}` : null,
        ].filter(Boolean);

        techCredits.forEach(tc => {
            if (tc) {
                 elements.push({ text: tc, type: 'credit', delay: staggerTimer, fontSizeMult: 0.4 });
                 staggerTimer += 0.2; 
            }
        });

        const cx = canvas.width * titleStyle.positionX;
        const cy = canvas.height * titleStyle.positionY;
        const exitDuration = 1.0;
        const timeRemaining = titleConfig.duration - currentTime;
        let globalExitAlpha = 1;
        if (timeRemaining < exitDuration) {
            globalExitAlpha = Math.max(0, timeRemaining / exitDuration);
        }

        elements.forEach((el, index) => {
             const elLocalTime = currentTime - el.delay;
             if (elLocalTime < 0) return; 

             const entryDuration = 1.0;
             const progress = Math.min(1, elLocalTime / entryDuration);
             const ease = 1 - Math.pow(1 - progress, 3); 

             const currentFontSize = titleStyle.fontSize * el.fontSizeMult;
             const effectiveStyle = { ...titleStyle, fontSize: currentFontSize };

             let x = cx;
             let y = cy;

             if (titleConfig.layoutMode === TitleLayoutMode.CENTERED) {
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 const totalHeightEstimate = elements.reduce((acc, e) => acc + (titleStyle.fontSize * e.fontSizeMult * 1.5), 0);
                 const startY = cy - (totalHeightEstimate / 2);
                 let yOffset = 0;
                 for(let i=0; i<index; i++) {
                     yOffset += titleStyle.fontSize * elements[i].fontSizeMult * 1.5;
                 }
                 y = startY + yOffset + (titleStyle.fontSize * el.fontSizeMult / 2); 

             } else if (titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT) {
                 const totalWidthEstimate = elements.reduce((acc, e) => acc + (titleStyle.fontSize * e.fontSizeMult * 1.5), 0);
                 const startX = cx + (totalWidthEstimate / 2);
                 let xOffset = 0;
                 for(let i=0; i<index; i++) {
                     xOffset += titleStyle.fontSize * elements[i].fontSizeMult * 1.5;
                 }
                 x = startX - xOffset - (titleStyle.fontSize * el.fontSizeMult / 2);
                 y = cy - (currentFontSize * el.text.length * 1.1 / 2);

             } else if (titleConfig.layoutMode === TitleLayoutMode.CINEMATIC) {
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 if (el.type === 'title') {
                     y = cy - 40;
                 } else if (el.type === 'subtitle') {
                     y = cy + currentFontSize;
                 } else {
                     y = canvas.height * 0.85 + (index - 2) * currentFontSize * 1.5;
                 }
             }

             let alpha = globalExitAlpha;
             let scale = 1;
             let yAnimOffset = 0;

             if (titleStyle.animationEffect === LyricEffect.FADE_UP) {
                 alpha *= ease;
                 yAnimOffset = (1 - ease) * 50;
                 if (titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT) {
                      yAnimOffset = 0; 
                      x += (1-ease) * 30;
                 } else {
                     y += yAnimOffset;
                 }
             } else if (titleStyle.animationEffect === LyricEffect.TYPEWRITER) {
                 const charCount = el.text.length;
                 const typeDuration = 1.5; 
                 const visibleChars = Math.floor(charCount * Math.min(1, elLocalTime / typeDuration));
                 el.text = el.text.substring(0, visibleChars);
             } else if (titleStyle.animationEffect === LyricEffect.SCATTER) {
                 alpha *= ease;
                 scale = 0.5 + ease * 0.5;
             } else {
                 alpha *= ease;
             }

             drawTextWithEffects(
                 el.text, x, y, effectiveStyle, titleStyle.activeColor, alpha, scale, 0, 
                 titleConfig.layoutMode === TitleLayoutMode.VERTICAL_RIGHT
             );
        });

    } 
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

      if (activeIndex !== -1) {
          const line = lrcLines[activeIndex];
          const nextLineTime = lrcLines[activeIndex + 1]?.time || (line.time + 5);
          const duration = nextLineTime - line.time;
          const progress = Math.max(0, Math.min(1, (currentTime - line.time) / duration));

          if (lyricStyle.animationEffect === LyricEffect.FADE_UP) {
              const entryDuration = 0.5;
              const entryProgress = Math.min(1, (currentTime - line.time) / entryDuration);
              const ease = 1 - Math.pow(1 - entryProgress, 3);
              const yOffset = (1 - ease) * 30;
              drawTextWithEffects(line.text, x, baseY + yOffset, lyricStyle, lyricStyle.activeColor, ease);
          } else if (lyricStyle.animationEffect === LyricEffect.TYPEWRITER) {
              const charCount = line.text.length;
              const typeDuration = Math.min(duration * 0.8, 2); 
              const visibleChars = Math.floor(charCount * Math.min(1, (currentTime - line.time) / typeDuration));
              const textToShow = line.text.substring(0, visibleChars);
              drawTextWithEffects(textToShow, x, baseY, lyricStyle, lyricStyle.activeColor);
          } else if (lyricStyle.animationEffect === LyricEffect.KARAOKE) {
              drawTextWithEffects(line.text, x, baseY, lyricStyle, lyricStyle.fontColor);
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
              const pulse = (Math.sin(currentTime * 3) + 1) / 2; 
              const scale = 1 + (pulse * 0.05); 
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

          if (activeIndex + 1 < lrcLines.length) {
              const nextLine = lrcLines[activeIndex + 1];
              const previewStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.7 };
              drawTextWithEffects(nextLine.text, x, baseY + lyricStyle.fontSize * 1.5, previewStyle, lyricStyle.fontColor);
          }
          if (activeIndex - 1 >= 0) {
              const prevLine = lrcLines[activeIndex - 1];
              const prevStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.7 };
              drawTextWithEffects(prevLine.text, x, baseY - lyricStyle.fontSize * 1.5, prevStyle, lyricStyle.fontColor);
          }

      } else {
        if (lrcLines.length > 0 && currentTime < lrcLines[0].time) {
             const previewStyle = {...lyricStyle, fontSize: lyricStyle.fontSize * 0.8 };
             drawTextWithEffects(lrcLines[0].text, x, baseY + lyricStyle.fontSize * 1.5, previewStyle, lyricStyle.fontColor);
             drawTextWithEffects("...", x, baseY, lyricStyle, lyricStyle.fontColor);
        }
      }
    }

  }, [backgrounds, currentTime, lrcLines, lyricStyle, titleStyle, titleConfig, isPlaying, transitionEffect, transitionDuration, visualizerConfig, drawScaledMedia, applyPostProcessing, drawGeometricOverlay]);

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
      drawCanvas(); 
    }
  }, [aspectRatio, drawCanvas]);


  // --- Controls ---
  const togglePlay = () => {
    if (audioRef.current) {
      setupAudioContext();
      if (isPlaying) {
        audioRef.current.pause();
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
     const canvasStream = canvasRef.current.captureStream(30); 
     let combinedStream = canvasStream;
     
     try {
         if (audioContextRef.current) {
             const dest = audioContextRef.current.createMediaStreamDestination();
             if (sourceNodeRef.current) {
                 sourceNodeRef.current.connect(dest);
                 const audioTrack = dest.stream.getAudioTracks()[0];
                 if (audioTrack) combinedStream.addTrack(audioTrack);
             }
         } else {
              // @ts-ignore
              if (audioRef.current.captureStream) {
                  // @ts-ignore
                  const audioStream = audioRef.current.captureStream();
                  combinedStream.addTrack(audioStream.getAudioTracks()[0]);
              } else if ((audioRef.current as any).mozCaptureStream) {
                  const audioStream = (audioRef.current as any).mozCaptureStream();
                  combinedStream.addTrack(audioStream.getAudioTracks()[0]);
              }
         }
     } catch (e) {
         console.error("Could not capture audio stream", e);
         alert("Audio capture failed.");
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
          if (isPlaying) togglePlay(); 
      }
  };


  return (
    <div className="flex h-screen w-full bg-black text-white">
      <audio 
        ref={audioRef} 
        src={audioSrc || undefined} 
        crossOrigin="anonymous" 
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

      <ProjectManager 
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        onSaveCurrent={handleSaveProject}
        onLoadProject={handleLoadProject}
        onExportConfig={handleExportConfig}
      />

      <ControlPanel 
        onAudioUpload={handleAudioUpload}
        onLrcUpload={handleLrcUpload}
        onBackgroundUpload={handleBackgroundUpload}
        backgrounds={backgrounds}
        onRemoveBackground={removeBackground}
        onDuplicateBackground={duplicateBackground}
        onMoveBackground={moveBackground}
        onUpdateBackgroundDuration={updateBackgroundDuration}
        
        lyricStyle={lyricStyle}
        setLyricStyle={setLyricStyle}
        
        titleStyle={titleStyle}
        setTitleStyle={setTitleStyle}

        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        transitionEffect={transitionEffect}
        setTransitionEffect={setTransitionEffect}
        transitionDuration={transitionDuration}
        setTransitionDuration={setTransitionDuration}

        visualizerConfig={visualizerConfig}
        setVisualizerConfig={setVisualizerConfig}

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
        onOpenProjectManager={() => setIsProjectManagerOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
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
