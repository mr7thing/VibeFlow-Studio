import { LrcLine } from './types';

// Parse standard LRC format [mm:ss.xx]
export const parseLrc = (lrcContent: string): LrcLine[] => {
  const lines = lrcContent.split('\n');
  const result: LrcLine[] = [];
  const timeRegExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  lines.forEach((line) => {
    const match = timeRegExp.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = line.replace(timeRegExp, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  });

  return result.sort((a, b) => a.time - b.time);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getResolution = (aspect: string, quality: '720p' | '1080p' = '1080p') => {
  const is1080 = quality === '1080p';
  const short = is1080 ? 1080 : 720;
  const long = is1080 ? 1920 : 1280;

  switch (aspect) {
    case '9:16': return { width: short, height: long };
    case '1:1': return { width: short, height: short };
    case '16:9': default: return { width: long, height: short };
  }
};
