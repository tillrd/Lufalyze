import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface LoudnessMetrics {
  momentaryMax: number;
  shortTermMax: number;
  integrated: number;
}

interface Metrics {
  loudness: number;
  loudnessDetailed?: LoudnessMetrics;
  rms: number;
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

  // Check system dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };

    // Set initial dark mode
    document.documentElement.classList.toggle('dark', darkModeMediaQuery.matches);

    // Listen for changes
    darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
  }, []);

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
          setMetrics(message.data as Metrics);
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

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.wav')) {
      setError('Please select a WAV file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('File size exceeds 100MB limit. Please select a smaller file.');
      return;
    }

    console.log('Starting file processing:', file.name, 'Size:', file.size);
    setFileName(file.name);
    setFileSize(file.size);
    setProgress(0);
    setMetrics(null);
    setError(null);
    setIsProcessing(true);

    try {
      console.log('Reading file as ArrayBuffer...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);
      
      console.log('Creating AudioContext...');
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      
      console.log('Decoding audio data...');
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      console.log('Decoded audio:', {
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        numberOfChannels: decoded.numberOfChannels,
        length: decoded.length
      });

      if (decoded.numberOfChannels > 2) {
        setError('Multichannel audio (5.1 or more) is not supported. Please use stereo or mono WAV files.');
        setIsProcessing(false);
        return;
      }
      
      const channelData = decoded.getChannelData(0);
      console.log('Channel data length:', channelData.length);

      // Send to worker
      console.log('Sending data to worker...');
      if (!workerRef.current) {
        createWorker();
      }
      
      if (workerRef.current) {
        workerRef.current.postMessage({
          pcm: channelData,
          sampleRate: decoded.sampleRate,
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
      }, 120000); // Increased timeout to 120 seconds for larger files
    } catch (error) {
      console.error('Error processing file:', error);
      setIsProcessing(false);
      if (error instanceof Error) {
        if (error.name === 'EncodingError') {
          setError('This WAV file appears to be corrupted or uses an unsupported format. Please try a different file.');
        } else {
          setError(`Error processing audio file: ${error.message}`);
        }
      } else {
        setError('Error processing audio file. Please try again.');
      }
      setProgress(0);
      setMetrics(null);
    }
  }, [progress]);

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
    if (file) handleFile(file);
  }, [handleFile]);

  const onInput = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const selectedPlatformData = PLATFORM_TARGETS.find(p => p.name === selectedPlatform);
  const currentLoudness = metrics?.loudnessDetailed?.integrated ?? metrics?.loudness ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Lufalyze
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Loudness analyzer implementing EBU R 128 / ITU-R BS.1770-4
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAbout(!showAbout)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                About
              </button>
              <a
                href="https://github.com/sponsors/tillrd"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-pink-600 border border-transparent rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Sponsor
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {showAbout && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">About Lufalyze</h2>
                <button 
                  onClick={() => setShowAbout(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
        <div className="mb-8">
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={clsx(
              'relative w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer',
              'transition-all duration-300',
              isDragging 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 transform scale-[1.02]' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50',
              isProcessing && 'pointer-events-none opacity-75'
            )}
          >
            <div className="text-center">
              <svg 
                className={clsx(
                  'w-16 h-16 mx-auto mb-4 transition-colors',
                  isDragging ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'
                )} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className={clsx(
                'text-lg font-medium mb-2 transition-colors',
                isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
              )}>
                Drop your WAV file here
              </p>
              <p className={clsx(
                'text-sm transition-colors',
                isDragging ? 'text-indigo-500' : 'text-gray-500 dark:text-gray-400'
              )}>
                or click to browse (max 100MB)
              </p>
            </div>
            <input
              type="file"
              accept="audio/wav,.wav"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={onInput}
              disabled={isProcessing}
              aria-label="Upload WAV audio file for loudness analysis"
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
                {fileSize && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(fileSize)}</p>
                )}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Momentary Max</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'momentary' ? null : 'momentary')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'momentary' && (
                          <div className="fixed inset-0 z-50" onClick={() => setActiveTooltip(null)}>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-72 p-4 text-sm text-gray-600 bg-white dark:bg-gray-700 dark:text-gray-300 rounded-lg shadow-xl">
                              <div className="relative">
                                <button 
                                  className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  onClick={() => setActiveTooltip(null)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <p>The loudest moment in your audio, measured over a very short time (400ms). Think of it as the peak volume - like the loudest part of a drum hit or a sudden sound effect.</p>
                              </div>
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
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'shortTerm' ? null : 'shortTerm')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'shortTerm' && (
                          <div className="fixed inset-0 z-50" onClick={() => setActiveTooltip(null)}>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-72 p-4 text-sm text-gray-600 bg-white dark:bg-gray-700 dark:text-gray-300 rounded-lg shadow-xl">
                              <div className="relative">
                                <button 
                                  className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  onClick={() => setActiveTooltip(null)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <p>The average loudness over a short period (3 seconds). This helps you understand how loud a section of your audio is, like a chorus or a scene in a video.</p>
                              </div>
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
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'integrated' ? null : 'integrated')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'integrated' && (
                          <div className="fixed inset-0 z-50" onClick={() => setActiveTooltip(null)}>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-72 p-4 text-sm text-gray-600 bg-white dark:bg-gray-700 dark:text-gray-300 rounded-lg shadow-xl">
                              <div className="relative">
                                <button 
                                  className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  onClick={() => setActiveTooltip(null)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <p>The overall average loudness of your entire audio file. This is what streaming platforms and broadcasters use to make sure your content isn't too loud or too quiet compared to other content.</p>
                              </div>
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
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                          onClick={() => setActiveTooltip(activeTooltip === 'rms' ? null : 'rms')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {activeTooltip === 'rms' && (
                          <div className="fixed inset-0 z-50" onClick={() => setActiveTooltip(null)}>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-72 p-4 text-sm text-gray-600 bg-white dark:bg-gray-700 dark:text-gray-300 rounded-lg shadow-xl">
                              <div className="relative">
                                <button 
                                  className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  onClick={() => setActiveTooltip(null)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <p>A measure of the average power of your audio signal. It helps you understand how loud your audio will actually sound to listeners, taking into account how our ears perceive different frequencies.</p>
                              </div>
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
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_TARGETS.map((platform) => {
                      const difference = currentLoudness - platform.target;
                      const isInRange = difference >= platform.range[0] - platform.target && difference <= platform.range[1] - platform.target;
                      const isSelected = selectedPlatform === platform.name;
                      
                      return (
                        <button
                          key={platform.name}
                          onClick={() => setSelectedPlatform(platform.name)}
                          className={clsx(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            isSelected
                              ? 'bg-indigo-500 text-white shadow-md'
                              : isInRange
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          )}
                        >
                          {platform.name}
                          <span className="ml-2 text-xs">
                            {difference > 0 ? '+' : ''}{difference.toFixed(1)}
                          </span>
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
            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Processing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              Built with WebAssembly and Web Audio API • Open source on{' '}
              <a 
                href="https://github.com/tillrd/Lufalyze" 
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                GitHub
              </a>
            </p>
            <p className="text-xs">
              Created by{' '}
              <a 
                href="https://github.com/tillrd" 
                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Richard Tillard
              </a>
              {' • '}
              <a 
                href="https://github.com/tillrd/Lufalyze/blob/main/LICENSE" 
                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                MIT License
              </a>
              {' • '}
              <a 
                href="https://github.com/tillrd/Lufalyze/blob/main/README.md" 
                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Documentation
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App; 