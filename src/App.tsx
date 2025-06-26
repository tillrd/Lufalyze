import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import WaveformVisualizer from './components/WaveformVisualizer';
import AnalysisSelector, { AnalysisOptions } from './components/AnalysisSelector';
import AnalysisUpgrade from './components/AnalysisUpgrade';
// Loading screen removed per user request
// Remove direct import to prevent bundling - use dynamic imports only
import { logger } from './utils/logger';
// Modern web features
import { 
  initializeModernFeatures, 
  getModernFeatureSupport,
  ScreenWakeLock,
  VisualViewportManager,
  DurationFormatter,
  getNavigationTiming
} from './shared/utils/modernFeatures';
import { ModernPopover, LazyImage } from './components/common/ModernHTMLComponents';
// Simple WAV metadata extraction using File API

// Centralized type imports
import {
  AudioFileInfo,
  AudioMetrics,
  Metrics,
  WorkerMessage,
} from './shared/types';
import { PLATFORM_TARGETS } from './shared/constants/platforms';
import FileUploader from './features/file-management/components/FileUploader';

// All type definitions have been moved to centralized files in src/shared/types/

const App: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  // File upload state now managed by FileUploader component
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
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showAnalysisSelector, setShowAnalysisSelector] = useState(false);
  const [showAnalysisUpgrade, setShowAnalysisUpgrade] = useState(false);
  const [selectedAnalysisOptions, setSelectedAnalysisOptions] = useState<AnalysisOptions>({
    loudness: true,
    stereo: true,
    technical: true
  });
  const [pendingAnalysisData, setPendingAnalysisData] = useState<{
    file: File;
    audioBuffer: AudioBuffer;
    audioFileInfo: AudioFileInfo;
    audioUrl: string;
  } | null>(null);
  
  // Use refs to store values that need to be accessed in worker callbacks
  const processingStartTimeRef = useRef<number | null>(null);
  const fileSizeRef = useRef<number | null>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const metricsDurationRef = useRef<number | null>(null);
  const audioFileInfoRef = useRef<AudioFileInfo | null>(null);
  
  // Modern web features state
  const [modernFeatures, setModernFeatures] = useState<any>(null);
  const [screenWakeLock] = useState(() => new ScreenWakeLock());
  const [visualViewport] = useState(() => new VisualViewportManager());
  const [navigationTiming, setNavigationTiming] = useState<any>(null);

  // Enhanced dark mode and mobile detection + modern features initialization
  useEffect(() => {
    // Initialize modern web features
    initializeModernFeatures();
    setModernFeatures(getModernFeatureSupport());
    
    // Get navigation timing metrics
    const timing = getNavigationTiming();
    if (timing) {
      setNavigationTiming(timing);
      logger.info('📊 Navigation timing:', timing);
    }
    
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
    
    // Setup visual viewport listener
    visualViewport.onViewportChange('app', () => {
      logger.debug('📱 Viewport changed:', {
        height: visualViewport.height,
        width: visualViewport.width
      });
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      visualViewport.removeListener('app');
    };
  }, [visualViewport]);

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
            
            logger.debug('🔍 Debug state in worker result:', {
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
              duration: metricsDurationRef.current || (currentWaveformData ? currentWaveformData.length / 44100 : undefined),
              // Ensure audioFileInfo is included - it should come from resultMetrics but let's make sure
              audioFileInfo: resultMetrics.audioFileInfo || audioFileInfoRef.current || undefined
            };
            
            logger.debug('📊 Enhanced metrics created:', enhancedMetrics);
            logger.debug('📋 Audio file info in enhanced metrics:', enhancedMetrics.audioFileInfo);
            
            setMetrics(enhancedMetrics);
            setProgress(100);
            setError(null);
            setIsProcessing(false);
            
            // Show upgrade options only if this was a quick analysis
            const currentAnalysis = selectedAnalysisOptions;
            if (currentAnalysis.loudness && !currentAnalysis.stereo && !currentAnalysis.technical) {
              setShowAnalysisUpgrade(true);
            } else {
              // Hide upgrade options for Standard/Complete analysis
              setShowAnalysisUpgrade(false);
            }
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
        logger.error('Worker error:', error);
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

  // Debug metrics changes
  useEffect(() => {
    if (metrics) {
      logger.debug('🔍 Metrics updated:', {
        hasAudioFileInfo: !!metrics.audioFileInfo,
        audioFileInfo: metrics.audioFileInfo,
        allKeys: Object.keys(metrics)
      });
    }
  }, [metrics]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // extractAudioFileInfo function moved to FileUploader component

  const copyMetrics = useCallback(() => {
    if (!metrics) return;
    
    const loudnessText = metrics.loudnessDetailed 
      ? `Momentary Max: ${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS, Short Term Max: ${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS, Integrated: ${metrics.loudnessDetailed.integrated.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`
      : `Integrated: ${metrics.loudness.toFixed(1)} LUFS, RMS: ${metrics.rms.toFixed(1)} dB`;
    
    // Add audio file details if available
    const fileDetailsText = metrics.audioFileInfo 
      ? `, File: ${metrics.audioFileInfo.format} ${metrics.audioFileInfo.sampleRate}Hz ${metrics.audioFileInfo.channels}ch${metrics.audioFileInfo.bitDepth ? ` ${metrics.audioFileInfo.bitDepth}bit` : ''}${metrics.audioFileInfo.bitrate ? ` ${metrics.audioFileInfo.bitrate}kbps` : ''}`
      : '';
    
    const text = loudnessText + fileDetailsText;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [metrics]);

  const exportPDF = useCallback(async () => {
    if (!metrics || !fileName) return;
    
    setIsExportingPDF(true);
    try {
      logger.info('🖨️ Starting PDF export...');
      
      // Direct dynamic import for true lazy loading
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
    } finally {
      setIsExportingPDF(false);
    }
  }, [metrics, fileName]);

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
          document.getElementById('file-upload')?.click();
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
          setShowAnalysisUpgrade(false);
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
        case 's':
          event.preventDefault();
          const spectrumElement = document.querySelector('[data-section="spectrum"]');
          spectrumElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'l':
          event.preventDefault();
          const loudnessElement = document.querySelector('[data-section="loudness"]');
          loudnessElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'f':
          event.preventDefault();
          const fileElement = document.querySelector('[data-section="file-details"]');
          fileElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'm':
          event.preventDefault();
          const musicElement = document.querySelector('[data-section="music"]');
          musicElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'p':
          event.preventDefault();
          const platformsElement = document.querySelector('[data-section="platforms"]');
          platformsElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 't':
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDarkMode, copyMetrics, exportPDF, metrics, showAbout]);

  // File upload handler - automatically starts quick analysis
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
    
    // Automatically start with Quick Analysis (loudness only)
    setSelectedAnalysisOptions({ loudness: true, stereo: false, technical: false });
    setShowAnalysisSelector(false);
    setShowAnalysisUpgrade(false);
    
    // Start quick analysis immediately
    const startTime = Date.now();
    setProcessingStartTime(startTime);
    setIsProcessing(true);
    
    // Update refs for worker callback access
    fileSizeRef.current = file.size;
    processingStartTimeRef.current = startTime;
    
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
          
          // Recreate worker for next use
          setTimeout(() => {
            createWorker();
          }, 100);
        }
      }, quickTimeout);
    }
  }, [createWorker]);

  // Start analysis with selected options
  const startAnalysis = useCallback(() => {
    if (!pendingAnalysisData) return;
    
    const { file, audioBuffer, audioFileInfo } = pendingAnalysisData;
    
    const startTime = Date.now();
    setProcessingStartTime(startTime);
    setIsProcessing(true);
    setShowAnalysisSelector(false);
    
    // Update refs for worker callback access
    fileSizeRef.current = file.size;
    processingStartTimeRef.current = startTime;
    
    // Continue with existing worker analysis
    if (!workerRef.current) {
      createWorker();
    }
    
    if (workerRef.current) {
      const channelData = audioBuffer.getChannelData(0);
      workerRef.current.postMessage({
        pcm: channelData,
        sampleRate: audioBuffer.sampleRate,
        audioFileInfo: audioFileInfo,
        analysisOptions: selectedAnalysisOptions, // Pass selected options to worker
      });
      
      // Set timeout for worker processing - adjust based on selected analysis
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      // Calculate timeout based on selected analysis types
      const selectedCount = Object.values(selectedAnalysisOptions).filter(Boolean).length;
      const baseTimeout = 120000; // 2 minutes base
      const timeoutMultiplier = selectedCount === 1 ? 0.5 : selectedCount === 2 ? 0.75 : 1.0;
      const adjustedTimeout = Math.round(baseTimeout * timeoutMultiplier);
      
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
          
          // Recreate worker for next use
          setTimeout(() => {
            createWorker();
          }, 100);
        }
      }, adjustedTimeout);
    }
  }, [pendingAnalysisData, selectedAnalysisOptions, progress, createWorker]);

  // Handle upgrade analysis
  const handleAnalysisUpgrade = useCallback((newOptions: AnalysisOptions) => {
    if (!pendingAnalysisData) return;
    
    const { file, audioBuffer, audioFileInfo } = pendingAnalysisData;
    
    // Update selected options and hide upgrade
    setSelectedAnalysisOptions(newOptions);
    setShowAnalysisUpgrade(false);
    
    const startTime = Date.now();
    setProcessingStartTime(startTime);
    setIsProcessing(true);
    
    // Update refs for worker callback access
    fileSizeRef.current = file.size;
    processingStartTimeRef.current = startTime;
    
    // Continue with existing worker analysis
    if (!workerRef.current) {
      createWorker();
    }
    
    if (workerRef.current) {
      const channelData = audioBuffer.getChannelData(0);
      workerRef.current.postMessage({
        pcm: channelData,
        sampleRate: audioBuffer.sampleRate,
        audioFileInfo: audioFileInfo,
        analysisOptions: newOptions, // Pass upgraded options to worker
      });
      
      // Set timeout for worker processing - adjust based on selected analysis
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      // Calculate timeout based on selected analysis types
      const selectedCount = Object.values(newOptions).filter(Boolean).length;
      const baseTimeout = 120000; // 2 minutes base
      const timeoutMultiplier = selectedCount === 1 ? 0.5 : selectedCount === 2 ? 0.75 : 1.0;
      const adjustedTimeout = Math.round(baseTimeout * timeoutMultiplier);
      
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
          
          // Recreate worker for next use
          setTimeout(() => {
            createWorker();
          }, 100);
        }
      }, adjustedTimeout);
    }
  }, [pendingAnalysisData, progress, createWorker]);

  // Drag/drop handlers and file input now handled by FileUploader component

  const selectedPlatformData = PLATFORM_TARGETS.find(p => p.name === selectedPlatform);
  const currentLoudness = metrics?.loudnessDetailed?.integrated ?? metrics?.loudness ?? 0;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900 scroll-contained relative-colors">
      {/* Skip Navigation Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-indigo-600 text-white px-4 py-2 rounded-md z-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 pt-safe-top">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Lufalyze
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
                Professional audio analysis platform
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 sm:hidden">
                Audio analysis platform
              </p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              {/* Modern Features Indicator */}
              {modernFeatures && (
                <ModernPopover
                  trigger={
                    <button 
                      className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors transform-enhanced"
                      aria-label="View modern web features support status"
                      title="Modern Features Dashboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  }
                  className="max-w-sm"
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm balanced-text">Modern Features Active</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(modernFeatures).map(([key, supported]) => (
                        <div key={key} className={`flex items-center space-x-1 ${supported ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-2 h-2 rounded-full ${supported ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                    </div>
                    {navigationTiming && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600">
                          <div>Load: {DurationFormatter.format({ seconds: navigationTiming.total / 1000 })}</div>
                          <div>DOM: {DurationFormatter.format({ seconds: navigationTiming.domContentLoaded / 1000 })}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </ModernPopover>
              )}
              {/* Keyboard shortcuts button */}
              <button
                onClick={() => setShowHotkeys(true)}
                className="relative group p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                aria-label="Show keyboard shortcuts (Press H)"
                title="Keyboard shortcuts"
              >
                {/* macOS Command Icon */}
                <div className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400 font-bold text-lg flex items-center justify-center">
                  ⌘
                </div>
                {/* Keyboard hint */}
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  H
                </span>
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="relative group p-2 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                aria-label="Toggle dark mode (Press D)"
              >
                {/* Keyboard hint */}
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
                className="relative group text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 sm:px-2 sm:py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="About (Press A)"
              >
                {/* Keyboard hint */}
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  A
                </span>
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

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-safe-bottom">
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
            </div>
        </div>
      )}

        {/* File Upload */}
        <FileUploader
          onFileUpload={handleFileUpload}
          onError={setError}
          onProgress={setProgress}
          onProcessingStart={() => setIsProcessing(true)}
          isProcessing={isProcessing}
          isMobile={isMobile}
          fileName={fileName}
          fileSize={fileSize}
          progress={progress}
          error={error}
        />

        {/* Analysis Selector */}
        {showAnalysisSelector && pendingAnalysisData && (
          <div className="mt-6">
            <AnalysisSelector
              onSelectionChange={setSelectedAnalysisOptions}
              onConfirm={startAnalysis}
              estimatedTime={pendingAnalysisData.audioBuffer.duration}
              fileSize={pendingAnalysisData.file.size}
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Results */}
      {metrics && (
          <div className="space-y-6">
            {/* Audio Spectrum Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-section="spectrum">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Audio Spectrum</h2>
                <WaveformVisualizer 
                  audioData={waveformData}
                  isAnalyzing={isAnalyzing}
                  duration={metrics.duration}
                  audioUrl={audioUrl}
                />
              </div>
            </div>

            {/* Main Results */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-section="loudness">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loudness Analysis</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={copyMetrics}
                      className={clsx(
                        'relative group inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all',
                        copySuccess
                          ? 'bg-green-500 text-white'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md hover:shadow-lg'
                      )}
                      aria-label={copySuccess ? "Copied!" : "Copy results (Press C)"}
                    >
                      {/* Keyboard hint */}
                      {!copySuccess && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          C
                        </span>
                      )}
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
                    <button
                      onClick={exportPDF}
                      onMouseEnter={() => {
                        // Preload PDF module on hover for better UX
                        import('./utils/pdfExport').catch(() => {
                          // Silently handle preload failures
                        });
                      }}
                      disabled={isExportingPDF}
                      className={clsx(
                        'relative group inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all',
                        isExportingPDF
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                      )}
                      aria-label={isExportingPDF ? "Exporting PDF..." : "Export PDF report (Press E)"}
                    >
                      {/* Keyboard hint */}
                      {!isExportingPDF && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          E
                        </span>
                      )}
                      {isExportingPDF ? (
                        <>
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Momentary Max</h3>
                      <div className="relative">
                        <button 
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 rounded"
                          onClick={() => setActiveTooltip(activeTooltip === 'momentary' ? null : 'momentary')}
                          aria-label="Show information about Momentary Max measurement"
                          aria-expanded={activeTooltip === 'momentary'}
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
                      <span className="sr-only">
                        {metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -10 ? ' (High level - may cause distortion)' :
                        metrics.loudnessDetailed?.momentaryMax && metrics.loudnessDetailed.momentaryMax > -14 ? ' (Moderate level)' :
                        ' (Good level)'}
                      </span>
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-section="platforms">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Platform Targets</h2>
                  <div className="relative">
                    <button 
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                      onClick={() => setActiveTooltip(activeTooltip === 'platformTargets' ? null : 'platformTargets')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {activeTooltip === 'platformTargets' && (
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
                            <h4 className="font-semibold text-gray-900 dark:text-white">Platform Targets</h4>
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
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            Different streaming and broadcast platforms have specific loudness targets to ensure consistent volume across content. These targets help your audio sound balanced alongside other content on each platform.
                          </p>
                          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                            <div><strong>Green:</strong> Your audio matches the platform's target range</div>
                            <div><strong>Red:</strong> Adjustment needed to meet platform standards</div>
                            <div><strong>Numbers:</strong> Show how many dB above (+) or below (-) the target</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
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
                            'px-3 py-2.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-center focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                            isMobile ? 'text-xs' : 'text-sm',
                            isSelected
                              ? 'bg-indigo-500 text-white shadow-md'
                              : isInRange
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          )}
                          aria-label={`${platform.name} platform target. ${isInRange ? 'Within target range' : 'Outside target range'}. Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(1)} dB`}
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


              </div>
            </div>

            {/* Audio File Information */}
            {metrics?.audioFileInfo && (
              <div className="mt-6 sm:mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-section="file-details">
                <div className="p-4 sm:p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audio File Details</h2>
                  </div>



                  {/* Grid layout - responsive, 2 boxes per line on desktop */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    
                    {/* Playback & Specs */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Playback & Specs
                        </div>
                        <div className="relative">
                          <button 
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                            onClick={() => setActiveTooltip(activeTooltip === 'playback' ? null : 'playback')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {activeTooltip === 'playback' && (
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
                                  <h4 className="font-semibold text-gray-900 dark:text-white">Playback & Specs</h4>
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
                                  Essential playback specifications for your audio file. Format shows the file type, duration tells you how long it plays, and channels indicate whether it's mono (voice/podcast) or stereo (music). Sample rate determines frequency precision - 44.1kHz is CD quality while 96kHz is high-resolution. Bit depth controls dynamic range precision - 16-bit for CD quality, 24-bit for professional recording.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Format</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                            {metrics.audioFileInfo?.format?.split(' ')[0] || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {metrics.audioFileInfo?.duration ? `${Math.floor(metrics.audioFileInfo.duration / 60)}:${String(Math.floor(metrics.audioFileInfo.duration % 60)).padStart(2, '0')}` : 'Unknown'}
                            {metrics.audioFileInfo?.duration && <span className="text-xs text-gray-500 ml-1">({metrics.audioFileInfo.duration.toFixed(1)}s)</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Channels</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {metrics.audioFileInfo?.channels || 'Unknown'} ({metrics.audioFileInfo?.channels === 1 ? 'Mono' : metrics.audioFileInfo?.channels === 2 ? 'Stereo' : 'Multi-channel'})
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sample Rate</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{metrics.audioFileInfo?.sampleRate?.toLocaleString() || 'Unknown'} Hz</span>
                        </div>
                        {metrics.audioFileInfo?.bitDepth && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bit Depth</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{metrics.audioFileInfo.bitDepth} bit</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          File Info
                        </div>
                        <div className="relative">
                          <button 
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                            onClick={() => setActiveTooltip(activeTooltip === 'fileInfo' ? null : 'fileInfo')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {activeTooltip === 'fileInfo' && (
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
                                  <h4 className="font-semibold text-gray-900 dark:text-white">File Info</h4>
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
                                  File storage and encoding information for your audio. File name identifies your audio, file size shows storage requirements, and bitrate indicates data flow per second - higher bitrates mean better quality but larger files. Encoding reveals the compression method - PCM is uncompressed for maximum quality, while other formats use compression to reduce file size.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">File Name</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white text-right break-all ml-2">
                            {metrics.audioFileInfo?.fileName || 'Unknown'}
                          </span>
                        </div>

                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">Creation Date</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white text-right ml-2">
                            {(() => {
                              if (metrics.audioFileInfo?.lastModified) {
                                const date = new Date(metrics.audioFileInfo.lastModified);
                                return date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true
                                });
                              }
                              return 'Unknown';
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">File Size</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {metrics.audioFileInfo?.fileSize ? formatFileSize(metrics.audioFileInfo.fileSize) : 'Unknown'}
                          </span>
                        </div>
                        {metrics.audioFileInfo?.bitrate && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bitrate</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{metrics.audioFileInfo.bitrate.toLocaleString()} kbps</span>
                          </div>
                        )}
                        {metrics.audioFileInfo?.encoding && (
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">Encoding</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white text-right ml-2">
                              {metrics.audioFileInfo.encoding}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Headroom & Safety */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Headroom & Safety
                        </div>
                        <div className="relative">
                          <button 
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                            onClick={() => setActiveTooltip(activeTooltip === 'headroom' ? null : 'headroom')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {activeTooltip === 'headroom' && (
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
                                  <h4 className="font-semibold text-gray-900 dark:text-white">Headroom & Safety</h4>
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
                                  Critical safety measurements to prevent distortion and ensure streaming compatibility. True peak level shows your audio's loudest moment - keep below -1.0 dBTP to avoid clipping. Headroom indicates safety margin before distortion occurs. Clipping risk warns of potential audio damage on playback devices. Streaming safe confirms your levels work well on Spotify, YouTube, and other platforms. Loudness match compares your audio to Spotify's -14 LUFS standard.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </h3>
                      <div className="space-y-3">
                        {metrics.loudnessDetailed?.momentaryMax && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">True Peak Level</span>
                            <span className={`text-sm font-semibold ${
                              metrics.loudnessDetailed.momentaryMax > -1.0 
                                ? 'text-red-600 dark:text-red-400' 
                                : metrics.loudnessDetailed.momentaryMax > -3.0 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {metrics.loudnessDetailed.momentaryMax.toFixed(1)} dBTP
                            </span>
                          </div>
                        )}
                        {metrics.loudnessDetailed?.momentaryMax && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Headroom Available</span>
                            <span className={`text-sm font-semibold ${
                              (-1.0 - metrics.loudnessDetailed.momentaryMax) < 1.0 
                                ? 'text-red-600 dark:text-red-400' 
                                : (-1.0 - metrics.loudnessDetailed.momentaryMax) < 2.0 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {Math.max(0, -1.0 - metrics.loudnessDetailed.momentaryMax).toFixed(1)} dB
                            </span>
                          </div>
                        )}
                        {metrics.loudnessDetailed?.momentaryMax && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Clipping Risk</span>
                            <span className={`text-sm font-semibold ${
                              metrics.loudnessDetailed.momentaryMax > -0.1 
                                ? 'text-red-600 dark:text-red-400' 
                                : metrics.loudnessDetailed.momentaryMax > -1.0 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {metrics.loudnessDetailed.momentaryMax > -0.1 
                                ? 'High Risk' 
                                : metrics.loudnessDetailed.momentaryMax > -1.0 
                                ? 'Moderate' 
                                : 'Low Risk'}
                            </span>
                          </div>
                        )}
                        {metrics.loudnessDetailed?.momentaryMax && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Streaming Safe</span>
                            <div className="flex items-center space-x-2">
                              {metrics.loudnessDetailed.momentaryMax <= -1.0 ? (
                                <>
                                  <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">Yes</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">No</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {metrics.loudnessDetailed?.integrated && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Loudness Match</span>
                            <span className={`text-sm font-semibold ${
                              Math.abs(metrics.loudnessDetailed.integrated + 14) < 1 
                                ? 'text-green-600 dark:text-green-400' 
                                : Math.abs(metrics.loudnessDetailed.integrated + 14) < 3 
                                ? 'text-yellow-600 dark:text-yellow-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {Math.abs(metrics.loudnessDetailed.integrated + 14) < 1 
                                ? 'Spotify Ready' 
                                : Math.abs(metrics.loudnessDetailed.integrated + 14) < 3 
                                ? 'Close Match' 
                                : 'Needs Adjustment'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stereo Field Analysis */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                          </svg>
                          Stereo Field Analysis
                        </div>
                        <div className="relative">
                          <button 
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                            onClick={() => setActiveTooltip(activeTooltip === 'stereoField' ? null : 'stereoField')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {activeTooltip === 'stereoField' && (
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
                                  <h4 className="font-semibold text-gray-900 dark:text-white">Stereo Field Analysis</h4>
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
                                  Spatial analysis of your stereo audio for optimal playback across all systems. Stereo width measures how spacious your audio sounds from mono to full stereo spread. Phase correlation shows how well left and right channels work together - positive values are good, negative values indicate phase problems. L/R balance checks if both channels have equal volume. Mono compatibility tests how your audio translates to single-speaker playback like phones. Imaging quality provides an overall assessment of your stereo soundstage.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </h3>
                      <div className="space-y-3">
                        {metrics.stereoAnalysis && !metrics.stereoAnalysis.is_mono ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Stereo Width</span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {metrics.stereoAnalysis.stereo_width !== undefined 
                                  ? `${(metrics.stereoAnalysis.stereo_width * 100).toFixed(1)}%`
                                  : 'Analyzing...'}
                              </span>
                            </div>
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
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">L/R Balance</span>
                              <span className={`text-sm font-semibold ${
                                metrics.stereoAnalysis.lr_balance !== undefined
                                  ? Math.abs(metrics.stereoAnalysis.lr_balance) <= 1.0
                                    ? 'text-green-600 dark:text-green-400'
                                    : Math.abs(metrics.stereoAnalysis.lr_balance) <= 3.0
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {metrics.stereoAnalysis.lr_balance !== undefined
                                  ? `${metrics.stereoAnalysis.lr_balance >= 0 ? '+' : ''}${metrics.stereoAnalysis.lr_balance.toFixed(1)} dB`
                                  : 'Analyzing...'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Mono Compatibility</span>
                              <span className={`text-sm font-semibold ${
                                metrics.stereoAnalysis.mono_compatibility !== undefined
                                  ? metrics.stereoAnalysis.mono_compatibility >= 0.8
                                    ? 'text-green-600 dark:text-green-400'
                                    : metrics.stereoAnalysis.mono_compatibility >= 0.6
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {metrics.stereoAnalysis.mono_compatibility !== undefined
                                  ? metrics.stereoAnalysis.mono_compatibility >= 0.8
                                    ? 'Excellent'
                                    : metrics.stereoAnalysis.mono_compatibility >= 0.6
                                    ? 'Good'
                                    : 'Poor'
                                  : 'Analyzing...'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Imaging Quality</span>
                              <span className={`text-sm font-semibold ${
                                metrics.stereoAnalysis.imaging_quality
                                  ? metrics.stereoAnalysis.imaging_quality === 'Professional'
                                    ? 'text-green-600 dark:text-green-400'
                                    : metrics.stereoAnalysis.imaging_quality === 'High Quality' || metrics.stereoAnalysis.imaging_quality === 'Good'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {metrics.stereoAnalysis.imaging_quality || 'Analyzing...'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Channel Mode</span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {metrics.audioFileInfo?.channels === 1 
                                  ? 'Mono' 
                                  : metrics.audioFileInfo?.channels === 2
                                  ? 'Stereo'
                                  : `${metrics.audioFileInfo?.channels || 'Unknown'}-Channel`}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Center Focus</span>
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {metrics.audioFileInfo?.channels === 1 ? 'Perfect' : 
                                 (metrics.stereoAnalysis?.phase_correlation ?? 0) > 0.9 ? 'Excellent' :
                                 (metrics.stereoAnalysis?.phase_correlation ?? 0) > 0.7 ? 'Good' : 'Fair'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Compatibility</span>
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                Universal
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Spatial Info</span>
                              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                {metrics.audioFileInfo?.channels === 1 ? 'None (Mono)' :
                                 (metrics.stereoAnalysis?.stereo_width ?? 0) < 0.2 ? 'Center-focused' :
                                 (metrics.stereoAnalysis?.stereo_width ?? 0) < 0.5 ? 'Moderate width' : 'Wide stereo'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Use Case</span>
                              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {metrics.audioFileInfo?.channels === 1 ? 'Voice/Podcast' :
                                 (metrics.stereoAnalysis?.stereo_width ?? 0) < 0.3 ? 'Dialog/Speech' : 'Music/Full Mix'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 text-center">Processing Information</h3>
              <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Processing Speed</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics.processingTime ? `${(metrics.processingTime / 1000).toFixed(2)}s` : 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">File Size</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics.fileSize ? `${(metrics.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Audio Duration</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {metrics.duration ? `${Math.floor(metrics.duration / 60)}:${(metrics.duration % 60).toFixed(0).padStart(2, '0')}` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Music analysis has been completely removed from this application */}

            {/* Technical Analysis Section */}
            {metrics.technicalAnalysis && (
              <div className="mt-6 sm:mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-section="technical">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Technical Analysis</h2>
                    <div className="relative">
                      <button 
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                        onClick={() => setActiveTooltip(activeTooltip === 'technicalAnalysis' ? null : 'technicalAnalysis')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {activeTooltip === 'technicalAnalysis' && (
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
                              <h4 className="font-semibold text-gray-900 dark:text-white">Technical Analysis</h4>
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
                             <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                               Advanced technical analysis providing deep insights into your audio's quality, compliance, and production characteristics.
                             </p>
                             <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                               <div><strong>True Peak:</strong> ITU-R BS.1770-4 compliant peak detection with platform compliance</div>
                               <div><strong>Quality Assessment:</strong> Digital artifacts, clipping, and DC offset detection</div>
                               <div><strong>Spectral Analysis:</strong> Frequency distribution and tonal balance across 7 bands</div>
                               <div><strong>Mastering Quality:</strong> Professional assessment of dynamics, warmth, clarity, and punchiness</div>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>

                   {/* True Peak & Compliance */}
                   <div className="mb-6">
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                       <svg className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                       True Peak Analysis
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg p-4">
                         <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">True Peak Level</div>
                         <div className={`text-2xl font-bold ${
                           metrics.technicalAnalysis.true_peak.level <= -1.0 
                             ? 'text-green-600 dark:text-green-400' 
                             : 'text-red-600 dark:text-red-400'
                         }`}>
                           {metrics.technicalAnalysis.true_peak.level.toFixed(2)} dBTP
                         </div>
                       </div>
                       <div className="space-y-2">
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Broadcast</span>
                           <div className={`flex items-center ${
                             metrics.technicalAnalysis.true_peak.broadcast_compliant 
                               ? 'text-green-600 dark:text-green-400' 
                               : 'text-red-600 dark:text-red-400'
                           }`}>
                             <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                 d={metrics.technicalAnalysis.true_peak.broadcast_compliant 
                                   ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                                   : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"} 
                               />
                             </svg>
                             <span className="text-sm font-medium">
                               {metrics.technicalAnalysis.true_peak.broadcast_compliant ? 'Pass' : 'Fail'}
                             </span>
                           </div>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Spotify</span>
                           <div className={`flex items-center ${
                             metrics.technicalAnalysis.true_peak.spotify_compliant 
                               ? 'text-green-600 dark:text-green-400' 
                               : 'text-red-600 dark:text-red-400'
                           }`}>
                             <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                 d={metrics.technicalAnalysis.true_peak.spotify_compliant 
                                   ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                                   : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"} 
                               />
                             </svg>
                             <span className="text-sm font-medium">
                               {metrics.technicalAnalysis.true_peak.spotify_compliant ? 'Pass' : 'Fail'}
                             </span>
                           </div>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">YouTube</span>
                           <div className={`flex items-center ${
                             metrics.technicalAnalysis.true_peak.youtube_compliant 
                               ? 'text-green-600 dark:text-green-400' 
                               : 'text-red-600 dark:text-red-400'
                           }`}>
                             <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                 d={metrics.technicalAnalysis.true_peak.youtube_compliant 
                                   ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                                   : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"} 
                               />
                             </svg>
                             <span className="text-sm font-medium">
                               {metrics.technicalAnalysis.true_peak.youtube_compliant ? 'Pass' : 'Fail'}
                             </span>
                           </div>
                         </div>
                       </div>
                       <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                         <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Peak Locations</div>
                         <div className="text-sm text-gray-700 dark:text-gray-300">
                           {metrics.technicalAnalysis.true_peak.locations.length > 0 
                             ? `${metrics.technicalAnalysis.true_peak.locations.length} peaks detected`
                             : 'No significant peaks'}
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Quality Assessment */}
                   <div className="mb-6">
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                       <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                       Quality Assessment
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="text-center">
                         <div className={`text-2xl font-bold mb-1 ${
                           !metrics.technicalAnalysis.quality.has_clipping 
                             ? 'text-green-600 dark:text-green-400' 
                             : 'text-red-600 dark:text-red-400'
                         }`}>
                           {metrics.technicalAnalysis.quality.has_clipping ? 'YES' : 'NO'}
                         </div>
                         <div className="text-sm text-gray-600 dark:text-gray-400">Digital Clipping</div>
                         {metrics.technicalAnalysis.quality.has_clipping && (
                           <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                             {metrics.technicalAnalysis.quality.clipped_samples} samples ({metrics.technicalAnalysis.quality.clipping_percentage.toFixed(3)}%)
                           </div>
                         )}
                       </div>
                       <div className="text-center">
                         <div className={`text-2xl font-bold mb-1 ${
                           Math.abs(metrics.technicalAnalysis.quality.dc_offset) < 0.001 
                             ? 'text-green-600 dark:text-green-400' 
                             : 'text-yellow-600 dark:text-yellow-400'
                         }`}>
                           {(metrics.technicalAnalysis.quality.dc_offset * 1000).toFixed(1)}
                         </div>
                         <div className="text-sm text-gray-600 dark:text-gray-400">DC Offset (mV)</div>
                       </div>
                       <div className="text-center">
                         <div className="text-2xl font-bold mb-1 text-blue-600 dark:text-blue-400">
                           {metrics.technicalAnalysis.silence.leading_silence.toFixed(1)}s
                         </div>
                         <div className="text-sm text-gray-600 dark:text-gray-400">Lead Silence</div>
                       </div>
                       <div className="text-center">
                         <div className="text-2xl font-bold mb-1 text-blue-600 dark:text-blue-400">
                           {metrics.technicalAnalysis.silence.trailing_silence.toFixed(1)}s
                         </div>
                         <div className="text-sm text-gray-600 dark:text-gray-400">Tail Silence</div>
                       </div>
                     </div>
                   </div>

                   {/* Spectral Analysis */}
                   <div className="mb-6">
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                       <svg className="w-5 h-5 mr-2 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                       </svg>
                       Frequency Analysis
                     </h3>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="space-y-4">
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Spectral Centroid</span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-white">
                             {(metrics.technicalAnalysis.spectral.centroid / 1000).toFixed(1)} kHz
                           </span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Spectral Rolloff</span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-white">
                             {(metrics.technicalAnalysis.spectral.rolloff / 1000).toFixed(1)} kHz
                           </span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-sm text-gray-600 dark:text-gray-400">Spectral Flatness</span>
                           <span className="text-sm font-semibold text-gray-900 dark:text-white">
                             {(metrics.technicalAnalysis.spectral.flatness * 100).toFixed(1)}%
                           </span>
                         </div>
                       </div>
                       <div>
                         <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Frequency Balance</div>
                         <div className="space-y-2">
                           {[
                             { name: 'Sub Bass', key: 'sub_bass', color: 'from-red-500 to-red-600' },
                             { name: 'Bass', key: 'bass', color: 'from-orange-500 to-orange-600' },
                             { name: 'Low Mids', key: 'low_mids', color: 'from-yellow-500 to-yellow-600' },
                             { name: 'Mids', key: 'mids', color: 'from-green-500 to-green-600' },
                             { name: 'Upper Mids', key: 'upper_mids', color: 'from-blue-500 to-blue-600' },
                             { name: 'Presence', key: 'presence', color: 'from-indigo-500 to-indigo-600' },
                             { name: 'Brilliance', key: 'brilliance', color: 'from-purple-500 to-purple-600' }
                           ].map((band) => (
                             <div key={band.key} className="flex items-center justify-between">
                               <span className="text-xs text-gray-600 dark:text-gray-400 w-20">{band.name}</span>
                               <div className="flex-1 mx-2">
                                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                   <div 
                                     className={`bg-gradient-to-r ${band.color} h-1.5 rounded-full transition-all`}
                                     style={{ width: `${Math.min(100, (metrics.technicalAnalysis!.spectral.frequency_balance as any)[band.key])}%` }}
                                   />
                                 </div>
                               </div>
                               <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
                                 {((metrics.technicalAnalysis!.spectral.frequency_balance as any)[band.key]).toFixed(0)}%
                               </span>
                             </div>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* Mastering Quality */}
                   <div>
                     <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                       <svg className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                       </svg>
                       Mastering Assessment
                     </h3>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="space-y-4">
                         <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                           <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                             {metrics.technicalAnalysis.mastering.quality_score.toFixed(0)}
                           </div>
                           <div className="text-sm text-gray-600 dark:text-gray-400">Overall Quality Score</div>
                           <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                             <div 
                               className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                               style={{ width: `${metrics.technicalAnalysis.mastering.quality_score}%` }}
                             />
                           </div>
                         </div>
                         <div className="space-y-3">
                           <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-600 dark:text-gray-400">PLR (Peak-to-Loudness)</span>
                             <span className="text-sm font-semibold text-gray-900 dark:text-white">
                               {metrics.technicalAnalysis.mastering.plr.toFixed(1)} dB
                             </span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-600 dark:text-gray-400">Dynamic Range</span>
                             <span className="text-sm font-semibold text-gray-900 dark:text-white">
                               {metrics.technicalAnalysis.mastering.dynamic_range.toFixed(1)} dB
                             </span>
                           </div>
                         </div>
                       </div>
                       <div className="space-y-3">
                         {[
                           { name: 'Punchiness', value: metrics.technicalAnalysis.mastering.punchiness, color: 'red' },
                           { name: 'Warmth', value: metrics.technicalAnalysis.mastering.warmth, color: 'orange' },
                           { name: 'Clarity', value: metrics.technicalAnalysis.mastering.clarity, color: 'blue' },
                           { name: 'Spaciousness', value: metrics.technicalAnalysis.mastering.spaciousness, color: 'purple' }
                         ].map((characteristic) => (
                           <div key={characteristic.name}>
                             <div className="flex justify-between items-center mb-1">
                               <span className="text-sm text-gray-600 dark:text-gray-400">{characteristic.name}</span>
                               <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                 {(characteristic.value * 100).toFixed(0)}%
                               </span>
                             </div>
                             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                               <div 
                                 className={`bg-gradient-to-r from-${characteristic.color}-400 to-${characteristic.color}-600 h-2 rounded-full transition-all`}
                                 style={{ width: `${characteristic.value * 100}%` }}
                               />
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             )}
            </div>
          )}

        {/* Analysis Upgrade Options */}
        {showAnalysisUpgrade && metrics && pendingAnalysisData && (
          <div className="mt-6">
            <AnalysisUpgrade
              currentOptions={selectedAnalysisOptions}
              onUpgrade={handleAnalysisUpgrade}
              estimatedTime={pendingAnalysisData.audioBuffer.duration}
              fileSize={pendingAnalysisData.file.size}
              disabled={isProcessing}
              onClose={() => setShowAnalysisUpgrade(false)}
            />
          </div>
        )}

        {/* Keyboard Shortcuts Modal */}
        {showHotkeys && (
          <div 
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowHotkeys(false)}
          >
            <div 
              className={clsx(
                "bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-slide-up max-w-md w-full max-h-[80vh] overflow-y-auto",
                isMobile ? "p-4" : "p-6"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                      <path d="M9 9v6h6V9H9z" />
                      <circle cx="7" cy="7" r="2" />
                      <circle cx="17" cy="7" r="2" />
                      <circle cx="7" cy="17" r="2" />
                      <circle cx="17" cy="17" r="2" />
                    </g>
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h4>
                </div>
                <button 
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setShowHotkeys(false)}
                  aria-label="Close keyboard shortcuts"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">General Actions</h5>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Upload file</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">U</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Copy results</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">C</kbd>
                    </div>
                    {metrics && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Export PDF report</span>
                        <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">E</kbd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Toggle dark mode</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">D</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Show about</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">A</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Show help</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">H</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Scroll to top</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">T</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Close modals</span>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">Esc</kbd>
                    </div>
                  </div>
                </div>

                {metrics && (
                  <>
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Navigation</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Jump to Audio Spectrum</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">S</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Jump to Loudness Analysis</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">L</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Jump to Platform Targets</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">P</kbd>
                        </div>
                        {metrics?.audioFileInfo && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Jump to File Details</span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">F</kbd>
                          </div>
                        )}
                        {false && ( // Music analysis removed
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Jump to Musical Analysis</span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">M</kbd>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Platform Selection</h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Select Spotify</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">1</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Select YouTube</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">2</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Select Apple Music</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">3</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Select Netflix</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">4</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Select Amazon</span>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">5</kbd>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Tip:</strong> Navigation shortcuts let you quickly jump between sections. Press T to scroll to top, or use S/L/P/F/M to jump to specific analysis sections. All hotkeys work when you're not typing in input fields.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading screen removed per user request */}
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

            {/* Desktop Three Column Layout */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
              
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