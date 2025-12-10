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
  duration: number; // For images (seconds), for videos (auto-detected)
}

export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
}

export interface LyricStyle {
  fontSize: number;
  fontColor: string;
  activeColor: string;
  shadowColor: string;
  shadowBlur: number;
  positionY: number; // 0 to 1 (percentage of height)
  bgOverlayOpacity: number;
}

export enum AspectRatio {
  LANDSCAPE_16_9 = '16:9',
  PORTRAIT_9_16 = '9:16',
  SQUARE_1_1 = '1:1',
}