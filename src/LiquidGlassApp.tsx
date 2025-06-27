import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  LiquidGlass, 
  GlassButton, 
  LayerCake
} from './components/LiquidGlass';
import WaveformVisualizer from './components/WaveformVisualizer';

// Import real types and components for audio processing (same as normal App)
import { AudioFileInfo } from './shared/types/audio';
import { Metrics } from './shared/types/metrics';
import { WorkerMessage } from './shared/types/worker';
import { PLATFORM_TARGETS } from './shared/constants/platforms';
import { logger } from './utils/logger';
import FileUploader from './features/file-management/components/FileUploader';
// Dynamic import for pdfExport (like normal App)

// Analysis options interface
interface AnalysisOptions {
  loudness: boolean;
  stereo: boolean;
  technical: boolean;
}

const LiquidGlassApp: React.FC = () => {
  // State order matching normal App for hook consistency
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Spotify');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [analysisLevel, setAnalysisLevel] = useState<'quick' | 'standard' | 'complete'>('quick');
  
  // Analysis options and data
  const [selectedAnalysisOptions, setSelectedAnalysisOptions] = useState<AnalysisOptions>({
    loudness: true,
    stereo: false,
    technical: false
  });
  const [pendingAnalysisData, setPendingAnalysisData] = useState<{
    file: File;
    audioBuffer: AudioBuffer;
    audioFileInfo: AudioFileInfo;
    audioUrl: string;
  } | null>(null);
  
  // Worker and processing refs
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const processingStartTimeRef = useRef<number | null>(null);
  const fileSizeRef = useRef<number | null>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const metricsDurationRef = useRef<number | null>(null);
  const audioFileInfoRef = useRef<AudioFileInfo | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Enhanced dark mode and mobile detection (matching main App)
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
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Export functions (using dynamic import like normal App)
  const exportPDF = async () => {
    if (!metrics || !fileName) return;
    
    try {
      logger.info('🖨️ Starting PDF export...');
      
      // Dynamic import for true lazy loading
      const { generatePDFReport } = await import('./utils/pdfExport');
      const pdfBytes = await generatePDFReport(metrics, fileName);
      
      // Create blob and download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace(/\.[^/.]+$/, '')}_analysis_report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      logger.info('✅ PDF export completed successfully');
    } catch (error) {
      logger.error('❌ PDF export failed:', error);
      setError('Failed to export PDF report. Please try again.');
    }
  };

  const copyMetrics = async () => {
    if (!metrics) return;
    
    try {
      const loudnessText = metrics.loudnessDetailed 
        ? `Momentary Max: ${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS, Short Term Max: ${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS, Integrated: ${metrics.loudnessDetailed.integrated.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`
        : `Integrated: ${metrics.loudness.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`;
      
      const fileDetailsText = metrics.audioFileInfo 
        ? `, File: ${metrics.audioFileInfo.format} ${metrics.audioFileInfo.sampleRate}Hz ${metrics.audioFileInfo.channels}ch${metrics.audioFileInfo.bitDepth ? ` ${metrics.audioFileInfo.bitDepth}bit` : ''}${metrics.audioFileInfo.bitrate ? ` ${metrics.audioFileInfo.bitrate}kbps` : ''}`
        : '';
      
      const text = loudnessText + fileDetailsText;
      
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs or textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Don't trigger if modifiers are pressed (except Shift for some keys)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'd':
          event.preventDefault();
          toggleDarkMode();
          break;
        case 'u':
          event.preventDefault();
          // Trigger file upload via FileUploader component
          const fileInput = document.querySelector('input[type="file"][accept*="audio"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
          break;
        case 'c':
          if (metrics) {
            event.preventDefault();
            copyMetrics();
          }
          break;
        case 'e':
          if (metrics) {
            event.preventDefault();
            exportPDF();
          }
          break;
        case 'h':
          event.preventDefault();
          setShowHotkeys(true);
          break;
        case 'escape':
          event.preventDefault();
          setActiveTooltip(null);
          setShowAbout(false);
          setShowHotkeys(false);
          setShowUpgrade(false);
          break;
        case 'a':
          if (!showAbout) {
            event.preventDefault();
            setShowAbout(true);
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          if (metrics) {
            event.preventDefault();
            const platforms = ['Spotify', 'YouTube', 'Apple Music', 'Netflix', 'Amazon'];
            const index = parseInt(event.key) - 1;
            if (platforms[index]) {
              setSelectedPlatform(platforms[index]);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [metrics, showAbout, copyMetrics, exportPDF]);

  // Worker creation and management
  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    try {
      workerRef.current = new Worker(new URL('./workers/loudness.worker.ts', import.meta.url), {
        type: 'module',
      });
      
      logger.info('✅ Worker created successfully');
    } catch (error) {
      logger.error('❌ Failed to create worker:', error);
      setError('Failed to initialize audio processing. Please refresh the page and try again.');
      return;
    }
    
    workerRef.current.onmessage = (e) => {
      const message = e.data as WorkerMessage;
      logger.info('📨 Worker message received:', message.type, message.data);
      
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
          
          const resultMetrics = message.data as Metrics;
          const currentProcessingTime = processingStartTimeRef.current ? Date.now() - processingStartTimeRef.current : undefined;
          
          const enhancedMetrics = {
            ...resultMetrics,
            processingTime: currentProcessingTime,
            fileSize: fileSizeRef.current || undefined,
            duration: metricsDurationRef.current || (waveformDataRef.current ? waveformDataRef.current.length / 44100 : undefined),
            audioFileInfo: resultMetrics.audioFileInfo || audioFileInfoRef.current || undefined
          };
          
          setMetrics(enhancedMetrics);
          setProgress(100);
          setError(null);
          setIsProcessing(false);
          setIsAnalyzing(false);
          
          // Show upgrade options for quick analysis
          const isQuickAnalysis = selectedAnalysisOptions.loudness === true && 
                                 selectedAnalysisOptions.stereo === false && 
                                 selectedAnalysisOptions.technical === false;
          
          if (isQuickAnalysis) {
            setTimeout(() => {
              setShowUpgrade(true);
            }, 100);
          } else {
            setShowUpgrade(false);
          }
          break;
        case 'error':
          if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setError(message.data as string);
          setProgress(0);
          setMetrics(null);
          setIsProcessing(false);
          setIsAnalyzing(false);
          break;
      }
    };

    workerRef.current.onerror = (error) => {
      logger.error('Worker error:', error);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError('Error processing audio file. Please try again.');
      setProgress(0);
      setMetrics(null);
      setIsProcessing(false);
      setIsAnalyzing(false);
    };
  }, []);

  // Initialize worker
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

  // Toggle dark mode and save preference
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
  };

  // File upload handler - start real analysis (like normal App)
  const handleFileUpload = useCallback((file: File, audioBuffer: AudioBuffer, audioFileInfo: AudioFileInfo, audioUrl: string) => {
    // Set file information
    setFileName(file.name);
    setFileSize(file.size);
    setAudioUrl(audioUrl);
    setError(null);
    setMetrics(null);
    setProgress(0);
    
    // Store analysis data for potential upgrades later
    setPendingAnalysisData({
      file,
      audioBuffer,
      audioFileInfo,
      audioUrl
    });
    
    // Get waveform data for visualization
    const channelData = audioBuffer.getChannelData(0);
    setWaveformData(channelData);
    waveformDataRef.current = channelData;
    metricsDurationRef.current = audioBuffer.duration;
    audioFileInfoRef.current = audioFileInfo;
    
    // Automatically start with Quick Analysis (loudness only) like normal app
    const quickAnalysisOptions = { loudness: true, stereo: false, technical: false };
    setSelectedAnalysisOptions(quickAnalysisOptions);
    setShowUpgrade(false);
    
    // Start quick analysis immediately
    const startTime = Date.now();
    processingStartTimeRef.current = startTime;
    setIsProcessing(true);
    setIsAnalyzing(true);
    
    // Update refs for worker callback access
    fileSizeRef.current = file.size;
    
    // Continue with existing worker analysis (Quick Analysis preset)
    if (!workerRef.current) {
      createWorker();
    }
    
    if (workerRef.current) {
      workerRef.current.postMessage({
        pcm: channelData,
        sampleRate: audioBuffer.sampleRate,
        audioFileInfo: audioFileInfo,
        analysisOptions: { loudness: true, stereo: false, technical: false }, // Quick analysis
      });
      
      // Set shorter timeout for quick analysis
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      const quickTimeout = 60000; // 1 minute for quick analysis
      
      timeoutRef.current = window.setTimeout(() => {
        if (progress < 100) {
          logger.warn('Worker processing timeout reached');
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
          }
          setError('Processing took too long. Please try a shorter audio file.');
          setProgress(0);
          setMetrics(null);
          setIsProcessing(false);
          setIsAnalyzing(false);
          
          // Recreate worker for next use
          setTimeout(() => {
            createWorker();
          }, 100);
        }
      }, quickTimeout);
    }
  }, [createWorker]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    // Handle files will be processed by FileUploader component
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // Analysis function for upgrades
  const performAnalysis = useCallback((analysisOptions: AnalysisOptions) => {
    if (!pendingAnalysisData || !workerRef.current) {
      setError('No audio data available for analysis. Please upload a file first.');
      return;
    }

    const { audioBuffer, audioFileInfo } = pendingAnalysisData;
    
    // Clear previous metrics and show processing
    setError(null);
    setProgress(0);
    setIsProcessing(true);
    setIsAnalyzing(true);
    setShowUpgrade(false);
    
    // Update analysis options
    setSelectedAnalysisOptions(analysisOptions);
    
    // Start analysis
    const startTime = Date.now();
    processingStartTimeRef.current = startTime;
    
    // Get channel data
    const channelData = audioBuffer.getChannelData(0);
    
    // Send to worker
    const upgradeWorkerMessage = {
      pcm: channelData,
      sampleRate: audioBuffer.sampleRate,
      audioFileInfo: audioFileInfo,
      analysisOptions: analysisOptions,
    };
    
    logger.info('📤 Sending upgrade analysis message to worker:', {
      pcmLength: channelData.length,
      sampleRate: audioBuffer.sampleRate,
      analysisOptions: analysisOptions
    });
    
    workerRef.current.postMessage(upgradeWorkerMessage);
    
    // Set timeout based on analysis complexity
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    const timeoutDuration = analysisOptions.technical ? 120000 : // 2 minutes for complete
                           analysisOptions.stereo ? 90000 :     // 1.5 minutes for standard  
                           60000;                               // 1 minute for quick
    
    timeoutRef.current = window.setTimeout(() => {
      setError('Analysis timed out. Please try with a smaller file or lower analysis level.');
      setIsProcessing(false);
      setIsAnalyzing(false);
      setProgress(0);
    }, timeoutDuration);
  }, [pendingAnalysisData]);

  // Analysis upgrade functions
  const upgradeToStandard = () => {
    logger.info('🔄 Upgrading to Standard Analysis (loudness + stereo)');
    setAnalysisLevel('standard');
    performAnalysis({ loudness: true, stereo: true, technical: false });
  };

  const upgradeToComplete = () => {
    logger.info('🔄 Upgrading to Complete Analysis (loudness + stereo + technical)');
    setAnalysisLevel('complete');
    performAnalysis({ loudness: true, stereo: true, technical: true });
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDarkMode ? 'dark' : ''}`}>
      {/* Optimized background with reduced motion support */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 transition-colors duration-500" />
        
        {/* Simplified flowing elements - fewer animations for better performance */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gradient-to-br from-purple-300/12 via-pink-400/8 to-transparent rounded-full animate-liquid-dance" style={{ filter: 'blur(80px)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-gradient-to-tl from-blue-400/12 via-cyan-300/8 to-transparent rounded-full animate-morph-float" style={{ filter: 'blur(90px)', animationDelay: '5s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-gradient-to-r from-emerald-300/10 via-green-400/7 to-transparent rounded-full animate-spectrum-wave" style={{ filter: 'blur(70px)', animationDelay: '10s', transform: 'translate(-50%, -50%)' }} />
        
        {/* Subtle accent flows - reduced count for better performance */}
        <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-gradient-to-bl from-amber-300/10 via-orange-400/6 to-transparent rounded-full animate-color-shift" style={{ filter: 'blur(75px)', animationDelay: '3s' }} />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-gradient-to-tr from-violet-400/10 via-purple-300/6 to-transparent rounded-full animate-pulse-glow" style={{ filter: 'blur(65px)', animationDelay: '7s' }} />
        
        {/* Gentle overlay for depth */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-200/6 via-transparent to-pink-200/4" style={{ filter: 'blur(100px)' }} />
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-200/6 via-transparent to-cyan-200/4" style={{ filter: 'blur(120px)' }} />
        </div>
      </div>

      {/* Header */}
      <LiquidGlass variant="ultraThin" elevation="flat" className="sticky top-0 z-50 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto flex-wrap gap-4">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-glass-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Lufalyze
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                Professional audio analysis platform - Liquid Glass Edition
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 sm:hidden">
                Audio analysis platform
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Keyboard shortcuts button */}
            <button
              onClick={() => setShowHotkeys(true)}
              className="relative group p-2 sm:p-2.5 rounded-lg glass-white/30 hover:glass-white/50 dark:glass-black/30 dark:hover:glass-black/50 backdrop-blur-md shadow-glass-sm hover:shadow-glass-md transition-all"
              aria-label="Show keyboard shortcuts (Press H)"
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400 font-bold text-lg flex items-center justify-center">
                ⌘
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                H
              </span>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="relative group p-2 sm:p-2.5 rounded-lg glass-white/30 hover:glass-white/50 dark:glass-black/30 dark:hover:glass-black/50 backdrop-blur-md shadow-glass-sm hover:shadow-glass-md transition-all"
              aria-label="Toggle dark mode (Press D)"
            >
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                D
              </span>
              {isDarkMode ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button 
              onClick={() => setShowAbout(!showAbout)}
              className="relative group text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 sm:px-2 sm:py-1 rounded-lg glass-white/20 hover:glass-white/40 dark:glass-black/20 dark:hover:glass-black/40 backdrop-blur-sm transition-all"
              aria-label="About (Press A)"
            >
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                A
              </span>
              About
            </button>
            
            <a
              href="https://github.com/sponsors/tillrd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border border-transparent rounded-lg px-3 py-2 sm:px-4 sm:py-2 shadow-glass-md hover:shadow-glass-lg transition-all"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {isMobile ? 'Sponsor' : 'Sponsor'}
            </a>
          </div>
        </div>
      </LiquidGlass>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* About Dialog */}
        {showAbout && (
          <LiquidGlass
            variant="regular"
            elevation="floating"
            className="mb-8 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">About Lufalyze</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Professional audio analysis platform</p>
              </div>
              <button 
                onClick={() => setShowAbout(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg glass-white/20 hover:glass-white/40 dark:glass-black/20 dark:hover:glass-black/40 transition-all"
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
                  Version: 1.0.0 (Liquid Glass Edition)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Build: development • {new Date().toLocaleDateString()}
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Analysis Features</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Professional audio analysis capabilities including:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside mb-4">
                  <li>LUFS loudness measurement (ITU-R BS.1770-4)</li>
                  <li>True peak detection and platform compliance</li>
                  <li>Stereo field and phase correlation analysis</li>
                  <li>Technical quality assessment (clipping, DC offset)</li>
                  <li>Spectral analysis and frequency balance</li>
                  <li>Waveform visualization</li>
                  <li>Audio metadata extraction</li>
                  <li>Platform-specific optimization targets</li>
                  <li>WebAssembly performance optimization</li>
                </ul>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Professional-grade loudness analysis powered by open source algorithms. For critical applications, verify against certified tools.
                </p>
              </div>
            </div>
          </LiquidGlass>
        )}

        {/* Hotkeys Modal */}
        {showHotkeys && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowHotkeys(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <LiquidGlass 
                variant="regular" 
                elevation="floating" 
                className="w-full max-w-2xl p-6"
              >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
                <button 
                  onClick={() => setShowHotkeys(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg glass-white/20 hover:glass-white/40 dark:glass-black/20 dark:hover:glass-black/40 transition-all"
                  aria-label="Close keyboard shortcuts"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">General</h3>
                  {[
                    { key: 'D', action: 'Toggle dark mode' },
                    { key: 'U', action: 'Upload audio file' },
                    { key: 'A', action: 'About dialog' },
                    { key: 'H', action: 'Show shortcuts' },
                    { key: 'Esc', action: 'Close dialogs' }
                  ].map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.action}</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Analysis</h3>
                  {[
                    { key: 'C', action: 'Copy results' },
                    { key: 'E', action: 'Export PDF' },
                    { key: '1-5', action: 'Select platform' }
                  ].map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.action}</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 p-4 glass-white/20 dark:glass-black/20 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Shortcuts are disabled when typing in input fields. Press <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-600 rounded">Esc</kbd> to close any open dialog.
                </p>
                             </div>
             </LiquidGlass>
           </div>
           </div>
         )}
        {/* File upload area - using real FileUploader component */}
        {!metrics && (
          <LiquidGlass
            variant="regular"
            elevation="floating"
            className="p-6"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">📁 Upload Audio File</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Drag and drop your audio file or click to browse</p>
            </div>
            <FileUploader 
              onFileUpload={handleFileUpload}
              onError={setError}
              onProgress={setProgress}
              onProcessingStart={() => {
                setIsProcessing(true);
                setIsAnalyzing(true);
              }}
              isProcessing={isProcessing}
              isMobile={isMobile}
              fileName={fileName}
              fileSize={fileSize}
              progress={progress}
              error={error}
            />
          </LiquidGlass>
        )}

        

        {/* Error display */}
        {error && (
          <LiquidGlass
            variant="regular"
            elevation="floating"
            className="p-6"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">⚠️ Analysis Error</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Something went wrong during processing</p>
            </div>
            <LiquidGlass variant="thin" className="p-4 border-l-4 border-red-500">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <GlassButton
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setProgress(0);
                  setMetrics(null);
                  setIsProcessing(false);
                  setIsAnalyzing(false);
                }}
              >
                Try Again
              </GlassButton>
            </LiquidGlass>
          </LiquidGlass>
        )}



        {/* Results */}
        {metrics && (
          <div className="space-y-8">
            {/* Main Loudness Analysis */}
            <LiquidGlass
              variant="regular"
              elevation="floating"
              className="p-6"
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">📊 Loudness Analysis</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive LUFS measurements and RMS analysis</p>
              </div>
              <div className="space-y-6">
                {/* Action Buttons */}
                <div className="flex justify-center space-x-3">
                  <GlassButton
                    variant={copySuccess ? "accent" : "primary"}
                    size="sm"
                    onClick={copyMetrics}
                    disabled={copySuccess}
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
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={exportPDF}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </GlassButton>
                </div>

                {/* Main Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Momentary Max */}
                  <LiquidGlass variant="thin" className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Momentary Max</h3>
                      <button 
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:ring-2 focus:ring-indigo-500 rounded"
                        onClick={() => setActiveTooltip(activeTooltip === 'momentary' ? null : 'momentary')}
                        aria-label="Show information about Momentary Max"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -10 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -14 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.momentaryMax.toFixed(1)} LUFS
                    </p>
                  </LiquidGlass>

                  {/* Short Term Max */}
                  <LiquidGlass variant="thin" className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Short Term Max</h3>
                      <button 
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                        onClick={() => setActiveTooltip(activeTooltip === 'shortTerm' ? null : 'shortTerm')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.shortTermMax && metrics.loudnessDetailed.shortTermMax > -12 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.shortTermMax && metrics.loudnessDetailed.shortTermMax > -16 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.shortTermMax.toFixed(1)} LUFS
                    </p>
                  </LiquidGlass>

                  {/* Integrated */}
                  <LiquidGlass variant="thin" className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Integrated</h3>
                      <button 
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                        onClick={() => setActiveTooltip(activeTooltip === 'integrated' ? null : 'integrated')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.loudnessDetailed?.integrated && metrics.loudnessDetailed.integrated > -14 ? 'text-red-600 dark:text-red-400' :
                      metrics.loudnessDetailed?.integrated && metrics.loudnessDetailed.integrated > -18 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.loudnessDetailed?.integrated.toFixed(1)} LUFS
                    </p>
                  </LiquidGlass>
                  
                  {/* RMS Level */}
                  <LiquidGlass variant="thin" className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">RMS Level</h3>
                      <button 
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                        onClick={() => setActiveTooltip(activeTooltip === 'rms' ? null : 'rms')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <p className={`text-2xl font-bold ${
                      metrics.rms > -6 ? 'text-red-600 dark:text-red-400' :
                      metrics.rms > -12 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {metrics.rms.toFixed(1)} dB
                    </p>
                  </LiquidGlass>
                </div>
              </div>
            </LiquidGlass>

            {/* Tooltips */}
            {activeTooltip && (
              <div 
                className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                onClick={() => setActiveTooltip(null)}
              >
                               <div onClick={(e: any) => e.stopPropagation()}>
                 <LiquidGlass
                   variant="regular"
                   elevation="floating"
                   className={`${isMobile ? "w-full max-w-sm p-4" : "w-80 p-6"}`}
                 >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {activeTooltip === 'momentary' ? 'Momentary Max' :
                       activeTooltip === 'shortTerm' ? 'Short Term Max' :
                       activeTooltip === 'integrated' ? 'Integrated' :
                       activeTooltip === 'rms' ? 'RMS Level' : ''}
                    </h4>
                    <button 
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg glass-white/20 hover:glass-white/40 dark:glass-black/20 dark:hover:glass-black/40 transition-all"
                      onClick={() => setActiveTooltip(null)}
                      aria-label="Close tooltip"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {activeTooltip === 'momentary' ? 'The loudest moment in your audio, measured over a very short time (400ms). Think of it as the peak volume - like the loudest part of a drum hit or a sudden sound effect.' :
                     activeTooltip === 'shortTerm' ? 'The average loudness over a short period (3 seconds). This helps you understand how loud a section of your audio is, like a chorus or a scene in a video.' :
                     activeTooltip === 'integrated' ? 'The overall average loudness of your entire audio file. This is what streaming platforms and broadcasters use to make sure your content isn\'t too loud or too quiet compared to other content.' :
                     activeTooltip === 'rms' ? 'A measure of the average power of your audio signal. It helps you understand how loud your audio will actually sound to listeners, taking into account how our ears perceive different frequencies.' : ''}
                  </p>
                                 </LiquidGlass>
                 </div>
               </div>
             )}

            {/* Audio Spectrum Visualization */}
            <LiquidGlass
              variant="regular"
              elevation="floating"
              className="p-6"
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">🌊 Audio Spectrum</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Visual representation of your audio waveform</p>
              </div>
              <div className="space-y-4">
                <WaveformVisualizer 
                  audioData={waveformData}
                  isAnalyzing={isAnalyzing}
                  duration={metrics.duration}
                  audioUrl={audioUrl}
                />
              </div>
            </LiquidGlass>

            {/* File Information */}
            {metrics.audioFileInfo && (
              <LiquidGlass
                variant="regular"
                elevation="floating"
                className="p-6"
              >
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">📁 File Information</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Technical details about your audio file</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <LiquidGlass variant="thin" className="p-4 text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.audioFileInfo.format?.includes('(') 
                        ? metrics.audioFileInfo.format?.split('(')[0].trim() 
                        : metrics.audioFileInfo.format}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Format</div>
                  </LiquidGlass>
                  
                  <LiquidGlass variant="thin" className="p-4 text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(metrics.audioFileInfo.sampleRate / 1000).toFixed(1)} kHz
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Sample Rate</div>
                  </LiquidGlass>
                  
                  <LiquidGlass variant="thin" className="p-4 text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.audioFileInfo.bitDepth ? `${metrics.audioFileInfo.bitDepth}-bit` : 'Variable'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Bit Depth</div>
                  </LiquidGlass>
                  
                  <LiquidGlass variant="thin" className="p-4 text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {metrics.audioFileInfo.channels === 1 ? 'Mono' : 
                       metrics.audioFileInfo.channels === 2 ? 'Stereo' : 
                       `${metrics.audioFileInfo.channels}-Ch`}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Channels</div>
                  </LiquidGlass>
                </div>
              </LiquidGlass>
            )}

            {/* Performance Metrics */}
            <LiquidGlass
              variant="regular"
              elevation="floating"
              className="p-6"
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">⚡ Processing Information</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Analysis performance and file details</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-glass-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Processing Speed</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics.processingTime ? `${(metrics.processingTime / 1000).toFixed(2)}s` : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-glass-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">File Size</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics.fileSize ? `${(metrics.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-glass-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Analysis Quality</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">Professional</p>
                </div>
              </div>
            </LiquidGlass>

            {/* Detailed Analysis Sections */}
            {analysisLevel === 'standard' && metrics.stereoAnalysis && (
              <LiquidGlass
              >
                <div className="space-y-4">
                  {!metrics.stereoAnalysis.is_mono ? (
                    <>
                      <LiquidGlass variant="thin" className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Stereo Width</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {metrics.stereoAnalysis.stereo_width !== undefined 
                              ? `${(metrics.stereoAnalysis.stereo_width * 100).toFixed(1)}%`
                              : 'Analyzing...'}
                          </span>
                        </div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Phase Correlation</span>
                          <span className={`text-sm font-semibold ${
                            metrics.stereoAnalysis.phase_correlation !== undefined
                              ? metrics.stereoAnalysis.phase_correlation >= 0.5
                                ? 'text-green-600 dark:text-green-400'
                                : metrics.stereoAnalysis.phase_correlation >= 0.2
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {metrics.stereoAnalysis.phase_correlation !== undefined
                              ? `${metrics.stereoAnalysis.phase_correlation >= 0 ? '+' : ''}${metrics.stereoAnalysis.phase_correlation.toFixed(2)}`
                              : 'Analyzing...'}
                          </span>
                        </div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Imaging Quality</span>
                          <span className={`text-sm font-semibold ${
                            metrics.stereoAnalysis.imaging_quality === 'High Quality'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {metrics.stereoAnalysis.imaging_quality || 'Analyzing...'}
                          </span>
                        </div>
                      </LiquidGlass>
                    </>
                  ) : (
                    <LiquidGlass variant="thin" className="p-4 text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Mono audio detected - perfect center focus
                      </div>
                    </LiquidGlass>
                  )}
                </div>
              </LiquidGlass>
            )}

            {/* Complete Technical Analysis */}
            {analysisLevel === 'complete' && metrics.technicalAnalysis && (
              <div className="space-y-8">
                {/* True Peak Analysis */}
                <LiquidGlass
                >
                  <div className="space-y-6">
                    {/* Main Peak Level Display */}
                    <LiquidGlass variant="thin" elevation="floating" className="p-6">
                      <div className="flex items-center justify-center space-x-8">
                        <div className="text-center">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">True Peak Level</div>
                          <div className={`text-4xl font-bold mb-2 ${
                            metrics.technicalAnalysis.true_peak.level <= -1.0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {metrics.technicalAnalysis.true_peak.level.toFixed(1)}
                          </div>
                          <div className="text-lg text-gray-600 dark:text-gray-400 font-medium mb-3">dBTP</div>
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                            metrics.technicalAnalysis.true_peak.level <= -1.0 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {metrics.technicalAnalysis.true_peak.level <= -1.0 ? '✓ Within Limits' : '⚠ Above Limit'}
                          </div>
                        </div>
                        
                        <div className="text-center border-l border-gray-200 dark:border-gray-700 pl-8">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Peak Events</div>
                          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            {metrics.technicalAnalysis.true_peak.locations.length}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">detected</div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            metrics.technicalAnalysis.true_peak.locations.length <= 50 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          }`}>
                            {metrics.technicalAnalysis.true_peak.locations.length <= 50 ? 'Ideal' : 'Acceptable'}
                          </div>
                        </div>
                      </div>
                    </LiquidGlass>

                    {/* Platform Compliance */}
                    <LiquidGlass variant="thin" className="p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Platform Compliance Status</h4>
                      <div className="space-y-3">
                        {[
                          { name: 'Broadcast Standard', compliant: metrics.technicalAnalysis.true_peak.broadcast_compliant, icon: '📻' },
                          { name: 'Spotify', compliant: metrics.technicalAnalysis.true_peak.spotify_compliant, icon: '🎵' },
                          { name: 'YouTube', compliant: metrics.technicalAnalysis.true_peak.youtube_compliant, icon: '📺' }
                        ].map((platform) => (
                          <div key={platform.name} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{platform.icon}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{platform.name}</span>
                            </div>
                            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                              platform.compliant 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              <span className="text-sm font-medium">{platform.compliant ? 'Pass' : 'Fail'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </LiquidGlass>
                  </div>
                </LiquidGlass>

                {/* Quality Assessment */}
                <LiquidGlass
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LiquidGlass variant="thin" className="p-4 text-center">
                      <div className="text-lg font-semibold text-green-600">Clean</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Digital Clipping</div>
                    </LiquidGlass>
                    
                    <LiquidGlass variant="thin" className="p-4 text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {typeof metrics.technicalAnalysis.quality.dc_offset === 'number' 
                          ? `${metrics.technicalAnalysis.quality.dc_offset.toFixed(3)} mV`
                          : metrics.technicalAnalysis.quality.dc_offset}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">DC Offset</div>
                    </LiquidGlass>
                  </div>
                </LiquidGlass>

                {/* Frequency Analysis */}
                <LiquidGlass
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <LiquidGlass variant="thin" className="p-3 text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {metrics.technicalAnalysis.spectral.centroid.toFixed(0)} Hz
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Spectral Centroid</div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-3 text-center">
                        <div className="text-lg font-semibold text-cyan-600">
                          {metrics.technicalAnalysis.spectral.rolloff.toFixed(0)} Hz
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Spectral Rolloff</div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-3 text-center">
                        <div className="text-lg font-semibold text-teal-600">
                          {(metrics.technicalAnalysis.spectral.flatness * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Spectral Flatness</div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-3 text-center">
                        <div className="text-lg font-semibold text-orange-600">
                          {metrics.technicalAnalysis.spectral.frequency_balance.bass.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Bass Balance</div>
                      </LiquidGlass>
                    </div>

                    {/* Frequency Balance */}
                    <LiquidGlass variant="thin" className="p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Frequency Balance</h4>
                      <div className="space-y-3">
                        {[
                          { name: 'Sub Bass (20-60Hz)', value: metrics.technicalAnalysis.spectral.frequency_balance.sub_bass },
                          { name: 'Bass (60-250Hz)', value: metrics.technicalAnalysis.spectral.frequency_balance.bass },
                          { name: 'Low Mids (250Hz-2kHz)', value: metrics.technicalAnalysis.spectral.frequency_balance.low_mids },
                          { name: 'Mids (2-4kHz)', value: metrics.technicalAnalysis.spectral.frequency_balance.mids },
                          { name: 'Upper Mids (4-6kHz)', value: metrics.technicalAnalysis.spectral.frequency_balance.upper_mids },
                          { name: 'Presence (6-12kHz)', value: metrics.technicalAnalysis.spectral.frequency_balance.presence },
                          { name: 'Brilliance (12-20kHz)', value: metrics.technicalAnalysis.spectral.frequency_balance.brilliance }
                        ].map((freq) => (
                          <div key={freq.name} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600 dark:text-gray-400">{freq.name}</span>
                              <span className="text-xs font-medium">{freq.value.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(freq.value, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </LiquidGlass>
                  </div>
                </LiquidGlass>

                {/* Mastering Assessment */}
                <LiquidGlass
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                        metrics.technicalAnalysis.mastering.quality_score >= 80 
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                          : 'bg-gradient-to-br from-yellow-400 to-amber-500'
                      } shadow-glass-lg`}>
                        <span className="text-2xl font-bold text-white">
                          {Math.round(metrics.technicalAnalysis.mastering.quality_score)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Overall Quality Score
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Excellent</p>
                    </div>

                    <div className="space-y-3">
                      <LiquidGlass variant="thin" className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">PLR</span>
                          <span className="font-semibold">{metrics.technicalAnalysis.mastering.plr.toFixed(1)} dB</span>
                        </div>
                      </LiquidGlass>
                      
                      <LiquidGlass variant="thin" className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Dynamic Range</span>
                          <span className="font-semibold">{metrics.technicalAnalysis.mastering.dynamic_range.toFixed(1)} dB</span>
                        </div>
                      </LiquidGlass>
                    </div>

                    <div className="space-y-3">
                      {[
                        { name: 'Warmth', value: metrics.technicalAnalysis.mastering.warmth, icon: '🔥' },
                        { name: 'Clarity', value: metrics.technicalAnalysis.mastering.clarity, icon: '💎' },
                        { name: 'Punchiness', value: metrics.technicalAnalysis.mastering.punchiness, icon: '👊' },
                        { name: 'Spaciousness', value: metrics.technicalAnalysis.mastering.spaciousness, icon: '🌌' }
                      ].sort((a, b) => b.value - a.value).map((characteristic) => (
                        <div key={characteristic.name} className="flex items-center space-x-3">
                          <span className="text-sm" role="img" aria-label={characteristic.name}>
                            {characteristic.icon}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {characteristic.name}
                              </span>
                              <span className="text-xs font-medium">
                                {characteristic.value.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(characteristic.value, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </LiquidGlass>

                {/* Export & Actions */}
                <LiquidGlass
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassButton
                      variant="primary"
                      size="lg"
                      onClick={exportPDF}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export PDF Report
                    </GlassButton>
                    
                    <GlassButton
                      variant="secondary"
                      size="lg"
                      onClick={copyMetrics}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Results
                    </GlassButton>
                  </div>
                </LiquidGlass>

                {/* Platform Targets */}
                <LiquidGlass
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {PLATFORM_TARGETS.map((platform) => {
                        const platformIcons: Record<string, string> = {
                          'Spotify': '🎵',
                          'Apple Music': '🍎',
                          'YouTube': '📺',
                          'TikTok/Instagram': '📱',
                          'Broadcast TV': '📻',
                          'Netflix': '🎬',
                          'Amazon Music': '📦'
                        };
                        return (
                          <button
                            key={platform.name}
                            onClick={() => setSelectedPlatform(platform.name)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedPlatform === platform.name
                                ? 'bg-indigo-500 text-white shadow-glass-md'
                                : 'glass-white/30 hover:glass-white/50 dark:glass-black/30 dark:hover:glass-black/50 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {platformIcons[platform.name] || '🎵'} {platform.name}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const selectedPlatformData = PLATFORM_TARGETS.find(p => p.name === selectedPlatform);
                      const currentLoudness = metrics.loudnessDetailed?.integrated ?? metrics.loudness ?? 0;
                      const difference = currentLoudness - (selectedPlatformData?.target ?? -14);
                      const platformIcons: Record<string, string> = {
                        'Spotify': '🎵',
                        'Apple Music': '🍎',
                        'YouTube': '📺',
                        'TikTok/Instagram': '📱',
                        'Broadcast TV': '📻',
                        'Netflix': '🎬',
                        'Amazon Music': '📦'
                      };
                      
                      return (
                        <LiquidGlass variant="thin" className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{platformIcons[selectedPlatform] || '🎵'}</span>
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{selectedPlatform}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Target: {selectedPlatformData?.target} LUFS
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                Math.abs(difference) <= 1 ? 'text-green-600 dark:text-green-400' :
                                Math.abs(difference) <= 3 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }`}>
                                {difference > 0 ? '+' : ''}{difference.toFixed(1)} LUFS
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.abs(difference) <= 1 ? 'Perfect match' :
                                Math.abs(difference) <= 3 ? 'Close match' :
                                difference > 0 ? 'Too loud' : 'Too quiet'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Your audio</span>
                              <span className="font-medium">{currentLoudness.toFixed(1)} LUFS</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">{selectedPlatform} target</span>
                              <span className="font-medium">{selectedPlatformData?.target} LUFS</span>
                            </div>
                            
                            {Math.abs(difference) > 1 && (
                              <div className="mt-3 p-3 glass-white/20 dark:glass-black/20 rounded-lg">
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {difference > 0 
                                    ? `Consider reducing the gain by ${Math.abs(difference).toFixed(1)} dB to match ${selectedPlatform}'s target.`
                                    : `Consider increasing the gain by ${Math.abs(difference).toFixed(1)} dB to match ${selectedPlatform}'s target.`
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </LiquidGlass>
                      );
                    })()}
                  </div>
                </LiquidGlass>
              </div>
            )}

            {/* Upgrade options - Progressive analysis flow */}
            {showUpgrade && (analysisLevel === 'quick' || analysisLevel === 'standard') && (
              <LiquidGlass
                variant="regular"
                elevation="floating"
                className="p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">🚀 Upgrade Analysis</h2>
                  <button 
                    onClick={() => setShowUpgrade(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg glass-white/20 hover:glass-white/40 dark:glass-black/20 dark:hover:glass-black/40 transition-all"
                    aria-label="Close upgrade options"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analysisLevel === 'quick' && (
                    <LiquidGlass variant="regular" elevation="floating" interactive className="p-6">
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-glass-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                          </svg>
                        </div>
                        <div className="text-xl font-semibold text-gray-900 dark:text-white">Add Stereo Analysis</div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Phase correlation, stereo width, L/R balance, imaging quality</p>
                        <div className="text-xs text-gray-500 dark:text-gray-400">~15 seconds</div>
                        <GlassButton variant="primary" onClick={upgradeToStandard}>Start Analysis</GlassButton>
                      </div>
                    </LiquidGlass>
                  )}
                  
                  <LiquidGlass variant="regular" elevation="floating" interactive className="p-6">
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 mx-auto bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-glass-md">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">Complete Analysis</div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Technical analysis, frequency spectrum, mastering metrics, platform compliance
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">~45 seconds</div>
                      <GlassButton variant="primary" onClick={upgradeToComplete}>Start Analysis</GlassButton>
                    </div>
                  </LiquidGlass>
                </div>
              </LiquidGlass>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiquidGlassApp; 