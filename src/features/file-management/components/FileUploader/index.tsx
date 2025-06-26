import React, { useCallback, useState, useRef } from 'react';
import clsx from 'clsx';
import { AudioFileInfo } from '../../../../shared/types';
import { logger } from '../../../../utils/logger';

interface FileUploaderProps {
  onFileUpload: (file: File, audioBuffer: AudioBuffer, audioFileInfo: AudioFileInfo, audioUrl: string) => void;
  onError: (error: string) => void;
  onProgress: (progress: number) => void;
  onProcessingStart: () => void;
  isProcessing: boolean;
  isMobile: boolean;
  fileName?: string | null;
  fileSize?: number | null;
  progress: number;
  error?: string | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUpload,
  onError,
  onProgress,
  onProcessingStart,
  isProcessing,
  isMobile,
  fileName,
  fileSize,
  progress,
  error
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const extractAudioFileInfo = async (file: File, audioBuffer: AudioBuffer): Promise<AudioFileInfo> => {
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    // Human-friendly format names
    const formatNames: Record<string, string> = {
      '.wav': 'WAV (Waveform Audio)',
      '.mp3': 'MP3 (MPEG Audio)',
      '.m4a': 'M4A (Apple Audio)',
      '.aac': 'AAC (Advanced Audio)',
      '.ogg': 'OGG Vorbis',
      '.flac': 'FLAC (Lossless)',
      '.webm': 'WebM Audio'
    };
    
    // Basic info from AudioBuffer
    const basicInfo: AudioFileInfo = {
      fileName: file.name,
      fileSize: file.size,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      format: formatNames[fileExt] || fileExt.replace('.', '').toUpperCase(),
      lastModified: file.lastModified,
    };

    try {
      if (fileExt === '.wav') {
        // Extract detailed WAV metadata
        const arrayBuffer = await file.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        
        // Parse WAV header - check for "RIFF" signature
        const riffHeader = String.fromCharCode(
          dataView.getUint8(0),
          dataView.getUint8(1), 
          dataView.getUint8(2),
          dataView.getUint8(3)
        );
        
        if (riffHeader === 'RIFF') {
          // Look for "fmt " chunk starting at byte 12
          let fmtChunkOffset = 12;
          let foundFmt = false;
          
          // Search for fmt chunk (might not always be at byte 12)
          for (let i = 12; i < Math.min(100, arrayBuffer.byteLength - 8); i += 4) {
            const chunkId = String.fromCharCode(
              dataView.getUint8(i),
              dataView.getUint8(i + 1),
              dataView.getUint8(i + 2),
              dataView.getUint8(i + 3)
            );
            if (chunkId === 'fmt ') {
              fmtChunkOffset = i;
              foundFmt = true;
              break;
            }
          }
          
          if (foundFmt) {
            const chunkSize = dataView.getUint32(fmtChunkOffset + 4, true);
            const audioFormat = dataView.getUint16(fmtChunkOffset + 8, true);
            const numChannels = dataView.getUint16(fmtChunkOffset + 10, true);
            const sampleRate = dataView.getUint32(fmtChunkOffset + 12, true);
            const byteRate = dataView.getUint32(fmtChunkOffset + 16, true);
            const bitsPerSample = dataView.getUint16(fmtChunkOffset + 22, true);
            
            logger.debug('🔍 WAV Header Data:', {
              audioFormat,
              numChannels,
              sampleRate,
              byteRate,
              bitsPerSample,
              calculatedBitrate: Math.round((sampleRate * numChannels * bitsPerSample) / 1000)
            });
            
            // Calculate proper bitrate for uncompressed audio
            let bitrate: number;
            if (audioFormat === 1 && bitsPerSample > 0) {
              // For PCM: sample_rate × channels × bit_depth ÷ 1000
              bitrate = Math.round((sampleRate * numChannels * bitsPerSample) / 1000);
            } else {
              // Use byte rate from header
              bitrate = Math.round((byteRate * 8) / 1000);
            }
            
            // Human-readable encoding names
            let encoding = 'Unknown Format';
            switch (audioFormat) {
              case 1: 
                encoding = 'PCM (Uncompressed Linear)'; 
                break;
              case 3: 
                encoding = 'IEEE Float (32-bit)'; 
                break;
              case 6: 
                encoding = 'A-law (8-bit)'; 
                break;
              case 7: 
                encoding = 'μ-law (8-bit)'; 
                break;
              case 17:
                encoding = 'ADPCM (Compressed)';
                break;
              case 85:
                encoding = 'MPEG Layer 3';
                break;
              case 65534: 
                encoding = 'Extensible (Multi-format)'; 
                break;
              default: 
                encoding = `Audio Format ${audioFormat}`;
            }
            
            return {
              ...basicInfo,
              sampleRate: sampleRate,        // Use ACTUAL file sample rate
              channels: numChannels,         // Use ACTUAL file channels  
              bitDepth: bitsPerSample > 0 ? bitsPerSample : undefined,
              bitrate: bitrate,
              encoding: encoding,
            };
          }
        }
      } else {
        // For compressed formats, estimate bitrate
        const estimatedBitrate = Math.round((file.size * 8) / (audioBuffer.duration * 1000)); // kbps
        
        const encodingMap: Record<string, string> = {
          '.mp3': 'MPEG-1/2 Audio Layer 3',
          '.m4a': 'AAC in MP4 Container',
          '.aac': 'Advanced Audio Coding',
          '.ogg': 'Vorbis Compression',
          '.flac': 'Free Lossless Audio Codec',
          '.webm': 'WebM/Opus Audio'
        };
        
        return {
          ...basicInfo,
          bitrate: estimatedBitrate,
          encoding: encodingMap[fileExt] || 'Compressed Audio Format',
        };
      }
    } catch (error) {
      logger.warn('⚠️ Failed to extract detailed metadata:', error);
    }
    
    return basicInfo;
  };

  const handleFileUpload = useCallback(async (file: File) => {
    // Supported audio formats
    const supportedFormats = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.webm'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!supportedFormats.includes(fileExt)) {
      onError('Please select a supported audio file (WAV, MP3, M4A, AAC, OGG, FLAC)');
      return;
    }

    // Format-specific file size limits (optimized for professional audio work)
    const formatLimits: Record<string, number> = {
      '.wav': 500 * 1024 * 1024,   // 500MB (uncompressed - long recordings)
      '.flac': 1024 * 1024 * 1024, // 1GB (lossless - very large files)
      '.mp3': 300 * 1024 * 1024,   // 300MB (compressed - long podcasts/music)
      '.m4a': 400 * 1024 * 1024,   // 400MB (compressed - high quality)
      '.aac': 400 * 1024 * 1024,   // 400MB (compressed - high quality)
      '.ogg': 350 * 1024 * 1024,   // 350MB (compressed - vorbis)
      '.webm': 350 * 1024 * 1024   // 350MB (compressed - opus)
    };
    
    const maxSize = formatLimits[fileExt] || 100 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      onError(`File size exceeds ${maxSizeMB}MB limit for ${fileExt.toUpperCase()} files. Please select a smaller file.`);
      return;
    }

    logger.info('📁 File upload started:', { name: file.name, size: file.size });
    
    setIsAnalyzing(true);
    onError(''); // Clear errors
    onProgress(0); // Reset progress bar to 0 for each new file
    onProcessingStart();
    
    try {
      // Create URL for audio playback
      const audioFileUrl = URL.createObjectURL(file);
      logger.info('🔗 Audio URL created:', audioFileUrl);
      
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode audio data with format-specific error handling
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        logger.info(`📊 ${fileExt.toUpperCase()} file decoded successfully:`, {
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
          channels: audioBuffer.numberOfChannels
        });
      } catch (decodeError) {
        logger.error('Audio decoding failed:', decodeError);
        throw new Error(`Failed to decode ${fileExt.toUpperCase()} file. The file may be corrupted or use an unsupported codec.`);
      }
      
      // Extract detailed audio file information
      const audioFileInfo = await extractAudioFileInfo(file, audioBuffer);
      logger.info('📋 Audio file info extracted:', audioFileInfo);
      
      logger.info('📊 Audio processed:', {
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        audioFileInfo
      });

      // Pass processed data to parent
      onFileUpload(file, audioBuffer, audioFileInfo, audioFileUrl);

    } catch (error) {
      logger.error('Error analyzing audio:', error);
      onError('Error analyzing audio file. Please try again.');
      onProgress(0);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onFileUpload, onError, onProgress, onProcessingStart]);

  const onDragEnter = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback<React.DragEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const onInput = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="mb-6 sm:mb-8">
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={clsx(
            'relative w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer',
            isMobile ? 'h-40 min-h-[10rem]' : 'h-48',
            isDragging 
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500',
            isProcessing && 'pointer-events-none opacity-75'
          )}
        >
          <div className="text-center px-4">
            <svg 
              className={clsx(
                'mx-auto mb-3 sm:mb-4',
                isMobile ? 'w-12 h-12' : 'w-16 h-16',
                isDragging ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'
              )} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className={clsx(
              'font-medium mb-2',
              isMobile ? 'text-base' : 'text-lg',
              isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
            )}>
              {isMobile ? 'Tap to select audio file' : 'Drop your audio file here'}
            </p>
            <p className={clsx(
              isMobile ? 'text-xs' : 'text-sm',
              isDragging ? 'text-indigo-500' : 'text-gray-500 dark:text-gray-400'
            )}>
              {isMobile ? 'WAV, MP3, M4A, AAC, OGG, FLAC' : 'or click to browse • WAV, MP3, M4A, AAC, OGG, FLAC'}
            </p>
            {!isMobile && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center justify-center space-x-1">
                <span>Or press</span>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-200 border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">U</kbd>
                <span>to upload</span>
              </p>
            )}
          </div>
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm"
            className="absolute inset-0 opacity-0 cursor-pointer focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50"
            onChange={onInput}
            disabled={isProcessing}
            aria-label="Upload audio file for analysis. Supported formats: WAV, MP3, M4A, AAC, OGG, FLAC"
            aria-describedby="file-upload-help"
            id="file-upload"
          />
          <span id="file-upload-help" className="sr-only">
            {isMobile ? 'Tap to select audio file' : 'Drop your audio file here or click to browse'}. 
            Supported formats include WAV, MP3, M4A, AAC, OGG, and FLAC.
          </span>
        </div>
      </div>

      {/* File Info & Progress */}
      {fileName && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{fileName}</h3>
              <div className="flex items-center space-x-4 mt-1">
                {fileSize && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(fileSize)}</p>
                )}
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  {fileName.toLowerCase().slice(fileName.lastIndexOf('.')).toUpperCase()} Audio
                </p>
              </div>
            </div>
            {isProcessing && (
              <div className="flex items-center text-indigo-600 dark:text-indigo-400">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`File processing: ${progress.toFixed(0)}% complete`}
            />
          </div>
          {progress > 0 && progress < 100 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{progress.toFixed(0)}% complete</p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader; 