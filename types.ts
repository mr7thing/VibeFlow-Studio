
export interface LrcLine {
  time: number; // in seconds
  text: string;
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export interface BackgroundMedia {
  id: string;
  type: MediaType;
  src: string; // Blob URL
  file: File;
  duration: number; // For images (seconds), for videos (0 = auto/original length)
}

export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
}

export enum LyricEffect {
  NONE = 'none',
  FADE_UP = 'fade_up',
  TYPEWRITER = 'typewriter',
  KARAOKE = 'karaoke',
  BREATHING = 'breathing',
  SCATTER = 'scatter',
}

export enum TransitionEffect {
  NONE = 'none',
  CROSSFADE = 'crossfade',
  FLASH_BLACK = 'flash_black',
  ZOOM_OUT = 'zoom_out',
  SHAKE = 'shake',
}

export interface LyricStyle {
  fontSize: number;
  fontFamily: string;
  fontColor: string; // Inactive line color
  activeColor: string; // Active line color
  shadowColor: string;
  shadowBlur: number;
  // New properties
  positionY: number; // 0 to 1 (percentage of height)
  positionX: number; // 0 to 1 (percentage of width)
  bgOverlayOpacity: number;
  glowColor: string;
  glowBlur: number;
  animationEffect: LyricEffect;
}

export enum TitleLayoutMode {
  CENTERED = 'centered',
  VERTICAL_RIGHT = 'vertical_right',
  CINEMATIC = 'cinematic',
}

export interface TitleConfig {
  enabled: boolean;
  layoutMode: TitleLayoutMode;
  duration: number; // seconds
  title: string;
  subtitle: string; // e.g. Album name or secondary title
  artist: string;
  author: string; // Lyrics by
  composer: string; // Music by
  producer: string;
}

export enum AspectRatio {
  LANDSCAPE_16_9 = '16:9',
  PORTRAIT_9_16 = '9:16',
  SQUARE_1_1 = '1:1',
}

// --- Persistence Types ---

export interface SavedProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string; // Base64 placeholder for future
}

// The complete serialized state
export interface SavedProjectData {
  id: string;
  name: string;
  updatedAt: number;
  // Configs
  lyricStyle: LyricStyle;
  titleStyle: LyricStyle;
  titleConfig: TitleConfig;
  aspectRatio: AspectRatio;
  // New Global Configs
  transitionEffect: TransitionEffect;
  transitionDuration: number;

  lrcLines: LrcLine[];
  // Assets Metadata
  audioFileName?: string;
  // We don't store Blobs in this object directly for structure, but they are stored in the 'assets' store
  // and referenced here.
  backgrounds: {
    id: string;
    type: MediaType;
    duration: number;
    fileName: string;
  }[];
}
