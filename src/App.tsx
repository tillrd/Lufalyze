import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import WaveformVisualizer from './components/WaveformVisualizer';

interface LoudnessMetrics {
  momentaryMax: number;
  shortTermMax: number;
  integrated: number;
}

interface Metrics {
  loudness: number;
  loudnessDetailed?: LoudnessMetrics;
  rms: number;
  tempo: number;
  performance: {
    totalTime: number;
    kWeightingTime: number;
    blockProcessingTime: number;
  };
  processingTime?: number;
  fileSize?: number;
  duration?: number;
}

interface PlatformTarget {
  name: string;
  target: number;
  range: [number, number];
  description: string;
}

const PLATFORM_TARGETS: PlatformTarget[] = [
  { name: 'Spotify', target: -14, range: [-14, -1], description: 'Music streaming' },
  { name: 'Apple Music', target: -16, range: [-16, -1], description: 'Music streaming' },
  { name: 'YouTube', target: -14, range: [-14, -1], description: 'Video platform' },
  { name: 'TikTok/Instagram', target: -14, range: [-14, -1], description: 'Social media' },
  { name: 'Broadcast TV', target: -23, range: [-23, -1], description: 'Television' },
  { name: 'Netflix', target: -27, range: [-27, -1], description: 'Streaming video' },
  { name: 'Amazon Music', target: -24, range: [-24, -1], description: 'Music streaming' },
];

interface WorkerMessage {
  type: 'progress' | 'result' | 'error';
  data: Metrics | number | string;
}

interface AudioMetrics {
  loudness: number;
  loudnessDetailed?: LoudnessMetrics;
  rms: number;
  tempo: number;
  performance: {
    totalTime: number;
    kWeightingTime: number;
    blockProcessingTime: number;
  };
  processingTime?: number;
  fileSize?: number;
  duration?: number;
  waveformData?: Float32Array;
}

const App: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Spotify');
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Use refs to store values that need to be accessed in worker callbacks
  const processingStartTimeRef = useRef<number | null>(null);
  const fileSizeRef = useRef<number | null>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const metricsDurationRef = useRef<number | null>(null);

  // Enhanced dark mode and mobile detection
  useEffect(() => {
    // Check mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    // Initial mobile check
    checkMobile();
    
    // Check stored dark mode preference or system preference
    const storedDarkMode = localStorage.getItem('darkMode');
    const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDarkMode = storedDarkMode ? storedDarkMode === 'true' : systemDarkMode;
    
    setIsDarkMode(initialDarkMode);
    document.documentElement.classList.toggle('dark', initialDarkMode);

    // Listen for window resize to update mobile state
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Toggle dark mode function
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
  };

  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
      workerRef.current = new Worker(new URL('./workers/loudness.worker.ts', import.meta.url), {
        type: 'module',
      });
      
      workerRef.current.onmessage = (e) => {
        const message = e.data as WorkerMessage;
        
        switch (message.type) {
          case 'progress':
            setProgress(message.data as number);
            break;
          case 'result':
          // Clear timeout on successful completion
          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
            // Add processing time and file info to metrics
            const resultMetrics = message.data as Metrics;
            
            // Use refs to access current values instead of closure
            const currentProcessingTime = processingStartTimeRef.current ? Date.now() - processingStartTimeRef.current : undefined;
            const currentFileSize = fileSizeRef.current;
            const currentWaveformData = waveformDataRef.current;
            
            console.log('🔍 Debug state in worker result:', {
              processingStartTime,
              currentProcessingTime,
              currentFileSize,
              waveformDataLength: currentWaveformData?.length,
              resultMetrics
            });
            
            const enhancedMetrics = {
              ...resultMetrics,
              processingTime: currentProcessingTime,
              fileSize: currentFileSize || undefined,
              duration: metricsDurationRef.current || (currentWaveformData ? currentWaveformData.length / 44100 : undefined)
            };
            
            console.log('📊 Enhanced metrics created:', enhancedMetrics);
            
            setMetrics(enhancedMetrics);
            setProgress(100);
            setError(null);
          setIsProcessing(false);
            break;
          case 'error':
          // Clear timeout on error
          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
            setError(message.data as string);
            setProgress(0);
            setMetrics(null);
          setIsProcessing(false);
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
      // Clear timeout on worker error
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
        setError('Error processing audio file. Please try again.');
        setProgress(0);
        setMetrics(null);
      setIsProcessing(false);
      };
  }, []);

  useEffect(() => {
    createWorker();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      workerRef.current?.terminate();
    };
  }, [createWorker]);

  // Cleanup audio URL
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const copyMetrics = useCallback(() => {
    if (!metrics) return;
    
    const text = metrics.loudnessDetailed 
      ? `Momentary Max: ${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS, Short Term Max: ${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS, Integrated: ${metrics.loudnessDetailed.integrated.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`
      : `Integrated: ${metrics.loudness.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [metrics]);

  const handleFileUpload = useCallback(async (file: File) => {
    // Supported audio formats
    const supportedFormats = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.webm'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!supportedFormats.includes(fileExt)) {
      setError('Please select a supported audio file (WAV, MP3, M4A, AAC, OGG, FLAC)');
      return;
    }

    // Format-specific file size limits (compressed formats can be larger)
    const formatLimits: Record<string, number> = {
      '.wav': 100 * 1024 * 1024,   // 100MB (uncompressed)
      '.flac': 200 * 1024 * 1024,  // 200MB (lossless)
      '.mp3': 75 * 1024 * 1024,    // 75MB (compressed)
      '.m4a': 75 * 1024 * 1024,    // 75MB (compressed)
      '.aac': 75 * 1024 * 1024,    // 75MB (compressed)
      '.ogg': 75 * 1024 * 1024,    // 75MB (compressed)
      '.webm': 75 * 1024 * 1024    // 75MB (compressed)
    };
    
    const maxSize = formatLimits[fileExt] || 100 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      setError(`File size exceeds ${maxSizeMB}MB limit for ${fileExt.toUpperCase()} files. Please select a smaller file.`);
      return;
    }

    console.log('📁 File upload started:', { name: file.name, size: file.size });
    
    setIsAnalyzing(true);
    setWaveformData(null);
    setAudioUrl(null);
    setError(null);
    setMetrics(null);
    
    // Set file information
    setFileName(file.name);
    setFileSize(file.size);
    const startTime = Date.now();
    setProcessingStartTime(startTime);
    setIsProcessing(true);
    
    // Update refs for worker callback access
    fileSizeRef.current = file.size;
    processingStartTimeRef.current = startTime;
    
    console.log('🎯 File info set:', {
      fileName: file.name,
      fileSize: file.size,
      startTime
    });
    
    try {
      // Create URL for audio playback
      const audioFileUrl = URL.createObjectURL(file);
      setAudioUrl(audioFileUrl);
      console.log('🔗 Audio URL created:', audioFileUrl);
      
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode audio data with format-specific error handling
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`📊 ${fileExt.toUpperCase()} file decoded successfully:`, {
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
          channels: audioBuffer.numberOfChannels
        });
      } catch (decodeError) {
        console.error('Audio decoding failed:', decodeError);
        throw new Error(`Failed to decode ${fileExt.toUpperCase()} file. The file may be corrupted or use an unsupported codec.`);
      }
      
      // Get waveform data
      const channelData = audioBuffer.getChannelData(0);
      setWaveformData(channelData);
      waveformDataRef.current = channelData;
      
      // Store accurate duration for later use
      const realDuration = audioBuffer.duration;
      
      console.log('📊 Audio processed:', {
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channelDataLength: channelData.length
      });

      // Continue with existing analysis
      if (!workerRef.current) {
        createWorker();
      }
      
      if (workerRef.current) {
        workerRef.current.postMessage({
        pcm: channelData,
          sampleRate: audioBuffer.sampleRate,
      });
      } else {
        throw new Error('Worker failed to initialize');
      }

      // Set timeout for worker processing
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = window.setTimeout(() => {
        if (progress < 100) {
          console.warn('Worker processing timeout reached');
          if (workerRef.current) {
            workerRef.current.terminate();
          workerRef.current = null;
          }
          setError('Processing took too long. Please try a shorter audio file.');
          setProgress(0);
          setMetrics(null);
          setIsProcessing(false);
          
          // Recreate worker for next use
          setTimeout(() => {
            createWorker();
          }, 100);
        }
      }, 120000);

      // Store the real duration in a ref for use in metrics
      metricsDurationRef.current = realDuration;

    } catch (error) {
      console.error('Error analyzing audio:', error);
      setError('Error analyzing audio file. Please try again.');
      setProgress(0);
      setMetrics(null);
      setIsProcessing(false);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

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

  const selectedPlatformData = PLATFORM_TARGETS.find(p => p.name === selectedPlatform);
  const currentLoudness = metrics?.loudnessDetailed?.integrated ?? metrics?.loudness ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 pt-safe-top">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Lufalyze
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
                Loudness analyzer implementing EBU R 128 / ITU-R BS.1770-4
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 sm:hidden">
                Audio loudness analyzer
              </p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <button 
                onClick={() => setShowAbout(!showAbout)}
                className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 sm:px-2 sm:py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                About
              </button>
              
              <a
                href="https://github.com/sponsors/tillrd"
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "inline-flex items-center text-xs sm:text-sm font-medium text-white bg-pink-600 border border-transparent rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all",
                  isMobile ? "px-3 py-2" : "px-4 py-2"
                )}
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {isMobile ? 'Sponsor' : 'Sponsor'}
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-safe-bottom">
        {showAbout && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">About Lufalyze</h2>
                <button 
                  onClick={() => setShowAbout(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close about dialog"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Version Information</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    Version: {import.meta.env.VITE_VERSION || '1.0.0'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Build: {import.meta.env.VITE_BUILD_HASH || 'dev'} 
                    {import.meta.env.VITE_BUILD_NUMBER && ` (#${import.meta.env.VITE_BUILD_NUMBER})`}
                    {import.meta.env.VITE_BUILD_DATE && ` • ${new Date(import.meta.env.VITE_BUILD_DATE).toLocaleDateString()}`}
                  </p>
                  
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Supported Formats</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    WAV, MP3, M4A, AAC, OGG Vorbis, FLAC, and WebM audio files are supported.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Maximum file sizes: WAV (100MB), FLAC (200MB), compressed formats (75MB each)
                  </p>
                  
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Privacy & Security</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    All processing happens locally in your browser using Web Audio API and WebAssembly. 
                    Your audio files are never uploaded to any server.
        </p>
      </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Technical Implementation</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    This analyzer implements the ITU-R BS.1770-4 standard for loudness measurement:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside mb-4">
                    <li>K-weighting filter implementation</li>
                    <li>Gating algorithm per specification</li>
                    <li>WebAssembly for performance</li>
                    <li>Open source and auditable</li>
                  </ul>
          <p className="text-sm text-gray-600 dark:text-gray-300">
                    Note: This is a reference implementation. For broadcast/mastering, verify against certified tools.
          </p>
                </div>
              </div>
            </div>
        </div>
      )}

        {/* File Upload */}
        <div className="mb-6 sm:mb-8">
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={clsx(
              'relative w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer',
              'transition-all duration-300',
              isMobile ? 'h-40 min-h-[10rem]' : 'h-48',
              isDragging 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 transform scale-[1.01] sm:scale-[1.02]' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50',
              isProcessing && 'pointer-events-none opacity-75'
            )}
          >
            <div className="text-center px-4">
              <svg 
                className={clsx(
                  'mx-auto mb-3 sm:mb-4 transition-colors',
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
                'font-medium mb-2 transition-colors',
                isMobile ? 'text-base' : 'text-lg',
                isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
              )}>
                {isMobile ? 'Tap to select audio file' : 'Drop your audio file here'}
              </p>
              <p className={clsx(
                'transition-colors',
                isMobile ? 'text-xs' : 'text-sm',
                isDragging ? 'text-indigo-500' : 'text-gray-500 dark:text-gray-400'
              )}>
                {isMobile ? 'WAV, MP3, M4A, AAC, OGG, FLAC' : 'or click to browse • WAV, MP3, M4A, AAC, OGG, FLAC'}
              </p>
            </div>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={onInput}
              disabled={isProcessing}
              aria-label="Upload audio file for loudness analysis"
              id="file-upload"
            />
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
                  {metrics?.duration && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.floor(metrics.duration / 60)}:{(metrics.duration % 60).toFixed(0).padStart(2, '0')}
                    </p>
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
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                style={{ '--progress-width': `${progress}%` } as React.CSSProperties}
            />
          </div>
            {progress > 0 && progress < 100 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{progress.toFixed(0)}% complete</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
        </div>
      )}

        {/* Results */}
      {metrics && (
          <div className="space-y-6">
            {/* Waveform Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Audio Waveform</h2>
                <WaveformVisualizer 
                  audioData={waveformData}
                  isAnalyzing={isAnalyzing}
                  duration={metrics.duration}
                  audioUrl={audioUrl}
                />
              </div>
            </div>

            {/* Main Results */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loudness Analysis</h2>
                  <button
                    onClick={copyMetrics}
                    className={clsx(
                      'inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all',
                      copySuccess
                        ? 'bg-green-500 text-white'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md hover:shadow-lg'
                    )}
                  >
                    {copySuccess ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Results
                      </>
                    )}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Momentary Max</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'momentary' ? null : 'momentary')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'momentary' && (
                          <div 
                            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                            onClick={() => setActiveTooltip(null)}
                          >
                            <div 
                              className={clsx(
                                "bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up",
                                isMobile ? "w-full max-w-sm p-4" : "w-80 p-6"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Momentary Max</h4>
                                <button 
                                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  onClick={() => setActiveTooltip(null)}
                                  aria-label="Close tooltip"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                The loudest moment in your audio, measured over a very short time (400ms). Think of it as the peak volume - like the loudest part of a drum hit or a sudden sound effect.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -10 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -14 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.momentaryMax.toFixed(1)} LUFS
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Short Term Max</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'shortTerm' ? null : 'shortTerm')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'shortTerm' && (
                          <div 
                            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                            onClick={() => setActiveTooltip(null)}
                          >
                            <div 
                              className={clsx(
                                "bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up",
                                isMobile ? "w-full max-w-sm p-4" : "w-80 p-6"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Short Term Max</h4>
                                <button 
                                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  onClick={() => setActiveTooltip(null)}
                                  aria-label="Close tooltip"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                The average loudness over a short period (3 seconds). This helps you understand how loud a section of your audio is, like a chorus or a scene in a video.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.shortTermMax && metrics.loudnessDetailed.shortTermMax > -12 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.shortTermMax && metrics.loudnessDetailed.shortTermMax > -16 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.shortTermMax.toFixed(1)} LUFS
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Integrated</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'integrated' ? null : 'integrated')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'integrated' && (
                          <div 
                            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                            onClick={() => setActiveTooltip(null)}
                          >
                            <div 
                              className={clsx(
                                "bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up",
                                isMobile ? "w-full max-w-sm p-4" : "w-80 p-6"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Integrated</h4>
                                <button 
                                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  onClick={() => setActiveTooltip(null)}
                                  aria-label="Close tooltip"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                The overall average loudness of your entire audio file. This is what streaming platforms and broadcasters use to make sure your content isn't too loud or too quiet compared to other content.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.integrated && metrics.loudnessDetailed.integrated > -14 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.integrated && metrics.loudnessDetailed.integrated > -18 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.integrated.toFixed(1)} LUFS
                </p>
              </div>
              
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">RMS Level</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'rms' ? null : 'rms')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'rms' && (
                          <div 
                            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                            onClick={() => setActiveTooltip(null)}
                          >
                            <div 
                              className={clsx(
                                "bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up",
                                isMobile ? "w-full max-w-sm p-4" : "w-80 p-6"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-semibold text-gray-900 dark:text-white">RMS Level</h4>
                                <button 
                                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  onClick={() => setActiveTooltip(null)}
                                  aria-label="Close tooltip"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                A measure of the average power of your audio signal. It helps you understand how loud your audio will actually sound to listeners, taking into account how our ears perceive different frequencies.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.rms > -6 ? 'text-red-600 dark:text-red-400' :
                      metrics.rms > -12 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                  {metrics.rms.toFixed(1)} dB
                </p>
              </div>
            </div>
          </div>
            </div>

            {/* Platform Targets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Platform Targets</h2>
                
                {/* Platform selector */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                    {PLATFORM_TARGETS.map((platform) => {
                      const difference = currentLoudness - platform.target;
                      const isInRange = difference >= platform.range[0] - platform.target && difference <= platform.range[1] - platform.target;
                      const isSelected = selectedPlatform === platform.name;
                      
                      return (
                        <button
                          key={platform.name}
                          onClick={() => setSelectedPlatform(platform.name)}
                          className={clsx(
                            'px-3 py-2.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-center',
                            isMobile ? 'text-xs' : 'text-sm',
                            isSelected
                              ? 'bg-indigo-500 text-white shadow-md'
                              : isInRange
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{platform.name}</span>
                            <span className={clsx("text-xs", isMobile ? "text-xs" : "text-xs")}>
                              {difference > 0 ? '+' : ''}{difference.toFixed(1)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected platform details */}
                {selectedPlatformData && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{selectedPlatformData.name}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{selectedPlatformData.description}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Target: {selectedPlatformData.target} LUFS</span>
                      <span className={clsx(
                        'text-sm font-mono',
                        Math.abs(currentLoudness - selectedPlatformData.target) <= 1 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {currentLoudness > selectedPlatformData.target ? '+' : ''}{(currentLoudness - selectedPlatformData.target).toFixed(1)} dB
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full transition-all',
                          Math.abs(currentLoudness - selectedPlatformData.target) <= 1 ? 'bg-green-500' : 'bg-red-500'
                        )}
                        style={{
                          '--range-width': `${Math.min(100, Math.max(0, 
                            ((currentLoudness - selectedPlatformData.range[0]) / 
                             (selectedPlatformData.range[1] - selectedPlatformData.range[0])) * 100
                          ))}%`
                        } as React.CSSProperties}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Processing Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Processing Speed</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.processingTime ? `${(metrics.processingTime / 1000).toFixed(2)}s` : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">File Size</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.fileSize ? `${(metrics.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Audio Duration</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.duration ? `${Math.floor(metrics.duration / 60)}:${(metrics.duration % 60).toFixed(0).padStart(2, '0')}` : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Track Tempo</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.tempo ? `${metrics.tempo} BPM` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-12 sm:mt-16 pb-safe-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Content */}
          <div className="py-6 sm:py-12">
            {/* Mobile Two Column Layout */}
            <div className="block sm:hidden">
              <div className="grid grid-cols-2 gap-3">
                {/* Left Column - Brand + Features */}
                <div className="space-y-5">
                  {/* Brand Section */}
                  <div>
                    <div className="flex items-center space-x-1 mb-2">
                      <div className="w-5 h-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Lufalyze
                      </h2>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-tight">
                      EBU R 128 loudness analyzer
                    </p>
                    <div className="flex space-x-1">
                      <a href="https://github.com/tillrd/Lufalyze" className="p-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="GitHub">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </a>
                      <a href="https://github.com/sponsors/tillrd" className="p-3 text-gray-500 dark:text-gray-400 hover:text-pink-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Sponsor">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>
                        </svg>
                      </a>
                    </div>
                  </div>

                  {/* Features Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                      Features
                    </h3>
                    <ul className="space-y-1">
                      <li><span className="text-xs text-gray-600 dark:text-gray-400">Waveform Analysis</span></li>
                      <li><span className="text-xs text-gray-600 dark:text-gray-400">LUFS Measurement</span></li>
                      <li><span className="text-xs text-gray-600 dark:text-gray-400">Platform Targets</span></li>
                    </ul>
                  </div>
                </div>

                {/* Right Column - Resources + Standards */}
                <div className="space-y-5">
                  {/* Resources Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                      Resources
                    </h3>
                    <ul className="space-y-1">
                      <li><a href="https://github.com/tillrd/Lufalyze/blob/main/README.md" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">Documentation</a></li>
                      <li><a href="https://github.com/tillrd/Lufalyze/wiki" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">User Guide</a></li>
                      <li><a href="https://github.com/tillrd/Lufalyze/issues" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">Report Issues</a></li>
                    </ul>
                  </div>

                  {/* Standards Section */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                      Standards
                    </h3>
                    <ul className="space-y-1">
                      <li><a href="https://tech.ebu.ch/docs/r/r128.pdf" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">EBU R 128</a></li>
                      <li><a href="https://www.itu.int/rec/R-REC-BS.1770/en" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">ITU-R BS.1770-4</a></li>
                      <li><a href="https://github.com/tillrd/Lufalyze/blob/main/PRIVACY.md" className="text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">Privacy Policy</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Four Column Layout */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              
              {/* Brand Section */}
              <div className="col-span-1">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Lufalyze
                  </h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                  Professional loudness analysis implementing EBU R 128 / ITU-R BS.1770-4 standards. 
                  Analyze audio directly in your browser with WebAssembly performance.
                </p>
                <div className="flex space-x-4">
                  <a href="https://github.com/tillrd/Lufalyze" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" aria-label="GitHub">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                  <a href="https://twitter.com/tillrd" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" aria-label="Twitter">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                  <a href="https://github.com/sponsors/tillrd" className="text-gray-500 dark:text-gray-400 hover:text-pink-500 transition-colors" aria-label="Sponsor">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Features Section */}
              <div className="col-span-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                  Features
                </h3>
                <ul className="space-y-3">
                  <li><span className="text-sm text-gray-600 dark:text-gray-400">Waveform Analysis</span></li>
                  <li><span className="text-sm text-gray-600 dark:text-gray-400">LUFS Measurement</span></li>
                  <li><span className="text-sm text-gray-600 dark:text-gray-400">Platform Targets</span></li>
                  <li><span className="text-sm text-gray-600 dark:text-gray-400">Spectrogram View</span></li>
                  <li><span className="text-sm text-gray-600 dark:text-gray-400">Dynamics Analysis</span></li>
                </ul>
              </div>

              {/* Resources Section */}
              <div className="col-span-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                  Resources
                </h3>
                <ul className="space-y-3">
                  <li><a href="https://github.com/tillrd/Lufalyze/blob/main/README.md" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Documentation</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/wiki" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">User Guide</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/blob/main/CONTRIBUTING.md" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contributing</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/issues" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Report Issues</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/releases" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Changelog</a></li>
                </ul>
              </div>

              {/* Standards Section */}
              <div className="col-span-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                  Standards
                </h3>
                <ul className="space-y-3">
                  <li><a href="https://tech.ebu.ch/docs/r/r128.pdf" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">EBU R 128</a></li>
                  <li><a href="https://www.itu.int/rec/R-REC-BS.1770/en" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">ITU-R BS.1770-4</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/blob/main/PRIVACY.md" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/blob/main/LICENSE" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">MIT License</a></li>
                  <li><a href="https://github.com/tillrd/Lufalyze/blob/main/SECURITY.md" className="text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Security</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 py-4 sm:py-6">
            {/* Mobile Layout */}
            <div className="block sm:hidden space-y-3">
              {/* Copyright */}
              <div className="text-center">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  © {new Date().getFullYear()} Lufalyze • Built with ❤️ by{' '}
                  <a href="https://github.com/tillrd" className="text-indigo-700 dark:text-indigo-300 hover:underline">
                    Richard Tillard
                  </a>
                </p>
              </div>
              
              {/* Status & Features */}
              <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Online</span>
                </div>
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Private</span>
                </div>
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>WebAssembly</span>
                </div>
              </div>
              
              {/* Version */}
              {import.meta.env.VITE_VERSION && (
                <div className="text-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    v{import.meta.env.VITE_VERSION}
                    {import.meta.env.VITE_BUILD_HASH && (
                      <span className="ml-1">({import.meta.env.VITE_BUILD_HASH.slice(0, 7)})</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex sm:flex-row items-center justify-between space-y-0">
              
              {/* Copyright and Status */}
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  © {new Date().getFullYear()} Lufalyze. Built with ❤️ by{' '}
                  <a href="https://github.com/tillrd" className="text-indigo-700 dark:text-indigo-300 hover:underline">
                    Richard Tillard
                  </a>
                </p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">All systems operational</span>
                </div>
              </div>

              {/* Technical Info */}
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Privacy-focused • No data collection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>WebAssembly powered</span>
                </div>
                {import.meta.env.VITE_VERSION && (
                  <div className="flex items-center space-x-1">
                    <span>v{import.meta.env.VITE_VERSION}</span>
                    {import.meta.env.VITE_BUILD_HASH && (
                      <span className="text-gray-500 dark:text-gray-400">({import.meta.env.VITE_BUILD_HASH.slice(0, 7)})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App; 