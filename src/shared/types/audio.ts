// Audio file metadata and information
export interface AudioFileInfo {
  fileName: string;
  fileSize: number;
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  bitrate?: number;
  format: string;
  encoding?: string;
  lastModified?: number;
} 