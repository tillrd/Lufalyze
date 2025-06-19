import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import WaveSurfer, { WaveSurfer as WaveSurferType } from 'wavesurfer.js';
import { logger } from '../utils/logger';

interface WaveformVisualizerProps {
  audioData: Float32Array | null;
  isAnalyzing: boolean;
  duration?: number;
  audioUrl?: string | null;
}

type VisualizationMode = 'waveform' | 'spectrogram' | 'peaks' | 'rms' | 'lufs' | 'dynamics';

interface AudioMetrics {
  peakLevel: number;
  rmsLevel: number;
  crestFactor: number;
  dynamicRange: number;
}

const calculateAudioMetrics = (data: Float32Array): AudioMetrics => {
  // Calculate peak level efficiently
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  const peakLevel = 20 * Math.log10(Math.max(peak, 1e-10));

  // Calculate RMS efficiently
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / data.length);
  const rmsLevel = 20 * Math.log10(Math.max(rms, 1e-10));

  // Calculate crest factor
  const crestFactor = peakLevel - rmsLevel;

  // Calculate dynamic range using smart sampling for performance
  const maxSamples = 10000;
  const step = Math.max(1, Math.floor(data.length / maxSamples));
  const samples = [];
  
  for (let i = 0; i < data.length; i += step) {
    samples.push(Math.abs(data[i]));
  }
  
  samples.sort((a, b) => a - b);
  
  const percentile10 = samples[Math.floor(samples.length * 0.1)] || 0;
  const percentile90 = samples[Math.floor(samples.length * 0.9)] || 0;
  
  const dynamicRange = 20 * Math.log10(Math.max(percentile90, 1e-10)) - 20 * Math.log10(Math.max(percentile10, 1e-10));

  return {
    peakLevel: Math.round(peakLevel * 10) / 10,
    rmsLevel: Math.round(rmsLevel * 10) / 10,
    crestFactor: Math.round(crestFactor * 10) / 10,
    dynamicRange: Math.round(dynamicRange * 10) / 10
  };
};

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioData, isAnalyzing, duration = 0, audioUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wavesurferRef = useRef<WaveSurferType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isWaveSurferReady, setIsWaveSurferReady] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('waveform');
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer with mobile-friendly settings
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4F46E5',
      progressColor: '#818CF8',
      cursorColor: '#C7D2FE',
      barWidth: isMobile ? 1 : 2,
      barGap: isMobile ? 0 : 1,
      height: isMobile ? 120 : 200,
      responsive: true,
      normalize: true,
      splitChannels: false,
      interact: true,
      hideScrollbar: true,
      minPxPerSec: isMobile ? 25 : 50,
      pixelRatio: window.devicePixelRatio || 1,
    });

    wavesurferRef.current = wavesurfer;

    // Event listeners with debugging
    const handlePlay = () => {
      logger.info('🎵 WaveSurfer play event');
      setIsPlaying(true);
    };
    const handlePause = () => {
      logger.info('⏸️ WaveSurfer pause event');
      setIsPlaying(false);
    };
    const handleTimeUpdate = (time: number) => setCurrentTime(time);
    const handleReady = () => {
      logger.info('✅ WaveSurfer ready event fired');
      setIsWaveSurferReady(true);
    };
    const handleZoomChange = (newZoom: number) => setZoom(newZoom);

    wavesurfer.on('play', handlePlay);
    wavesurfer.on('pause', handlePause);
    wavesurfer.on('timeupdate', handleTimeUpdate);
    wavesurfer.on('ready', handleReady);
    wavesurfer.on('zoom', handleZoomChange);

    // Cleanup
    return () => {
      wavesurfer.un('play', handlePlay);
      wavesurfer.un('pause', handlePause);
      wavesurfer.un('timeupdate', handleTimeUpdate);
      wavesurfer.un('ready', handleReady);
      wavesurfer.un('zoom', handleZoomChange);
      wavesurfer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!audioData || !wavesurferRef.current) return;

    logger.info('📊 Loading audio data into WaveSurfer', {
      hasAudioUrl: !!audioUrl,
      audioDataLength: audioData.length
    });

    // Reset ready state
    setIsWaveSurferReady(false);

    try {
      // Load audio - prefer original audio URL if available
      if (audioUrl) {
        logger.info('📤 Loading audio from URL:', audioUrl);
        wavesurferRef.current.load(audioUrl);
      } else {
        logger.info('📤 Creating audio buffer fallback');
        // Fallback: Create audio buffer and convert to WAV
    const audioContext = new AudioContext();
    const audioBuffer = audioContext.createBuffer(1, audioData.length, audioContext.sampleRate);
    audioBuffer.copyToChannel(audioData, 0);

        // Convert to WAV and load
    const wavBlob = audioBufferToWav(audioBuffer);
    const url = URL.createObjectURL(wavBlob);
        logger.info('📤 Loading audio from generated WAV blob:', url);
        wavesurferRef.current.load(url);

        // Clean up the created URL when component unmounts
    return () => {
      URL.revokeObjectURL(url);
      audioContext.close();
    };
      }
    } catch (error) {
      logger.error('Error loading audio into WaveSurfer:', error);
    }
  }, [audioData, audioUrl]);

  // Calculate metrics separately to avoid circular dependency
  useEffect(() => {
    if (!audioData) return;
    
    try {
      const calculatedMetrics = calculateAudioMetrics(audioData);
      setMetrics(calculatedMetrics);
    } catch (error) {
      logger.error('Error calculating metrics:', error);
    }
  }, [audioData]);

  // Canvas visualization effect
  useEffect(() => {
    if (!canvasRef.current || !audioData || visualizationMode === 'waveform') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with proper DPI handling
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 400 * dpr;
    
    // Scale the canvas back down using CSS for crisp rendering
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '400px';
    
    // Scale the drawing context so everything renders at the correct size
    ctx.scale(dpr, dpr);

    const drawVisualization = () => {
      ctx.clearRect(0, 0, rect.width, 400);

      const width = rect.width;
      const height = 400;
      const baseMargin = { top: 30, right: 120, bottom: 60, left: 80 };
      const margin = {
        top: baseMargin.top * scale,
        right: baseMargin.right * scale,
        bottom: baseMargin.bottom * scale,
        left: baseMargin.left * scale
      };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const dataPoints = Math.min(plotWidth, audioData.length);
      const step = Math.floor(audioData.length / dataPoints);

      // Helper function to draw axes
      const drawAxes = (xLabel: string, yLabel: string, yMin: number, yMax: number, yUnit: string = '') => {
        // Draw axes
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        // Y-axis
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        // X-axis
        ctx.moveTo(margin.left, height - margin.bottom);
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.stroke();

        // Y-axis labels and grid
        ctx.fillStyle = '#6B7280';
        ctx.font = `${Math.round(14 * scale)}px sans-serif`;
        ctx.textAlign = 'right';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
          const y = margin.top + (i / ySteps) * plotHeight;
          const value = yMax - (i / ySteps) * (yMax - yMin);
          ctx.fillText(`${value.toFixed(1)}${yUnit}`, margin.left - 8 * scale, y + 5 * scale);
          
          // Grid lines
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 1 * scale;
          ctx.beginPath();
          ctx.moveTo(margin.left, y);
          ctx.lineTo(width - margin.right, y);
          ctx.stroke();
        }

        // X-axis labels (time)
        ctx.textAlign = 'center';
        const xSteps = 6;
        const duration = audioData.length / 44100; // Assuming 44.1kHz sample rate
        for (let i = 0; i <= xSteps; i++) {
          const x = margin.left + (i / xSteps) * plotWidth;
          const timeValue = (i / xSteps) * duration;
          ctx.fillText(`${timeValue.toFixed(1)}s`, x, height - margin.bottom + 20 * scale);
          
          // Grid lines
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 1 * scale;
          ctx.beginPath();
          ctx.moveTo(x, margin.top);
          ctx.lineTo(x, height - margin.bottom);
          ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = '#374151';
        ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        // X-axis label
        ctx.fillText(xLabel, width / 2, height - 8 * scale);
        // Y-axis label (rotated)
        ctx.save();
        ctx.translate(20 * scale, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
      };

      switch (visualizationMode) {
        case 'peaks': {
          const peaks = [];
          for (let i = 0; i < dataPoints; i++) {
            const startIndex = i * step;
            const endIndex = Math.min(startIndex + step, audioData.length);
            let peak = 0;
            for (let j = startIndex; j < endIndex; j++) {
              peak = Math.max(peak, Math.abs(audioData[j]));
            }
            peaks.push(20 * Math.log10(Math.max(peak, 1e-10)));
          }

          const minDb = Math.min(...peaks);
          const maxDb = Math.max(...peaks);
          const yMin = minDb - 5;
          const yMax = maxDb + 5;

          drawAxes('Time', 'Peak Level', yMin, yMax, ' dB');
          
          ctx.beginPath();
          ctx.strokeStyle = '#4F46E5';
          ctx.lineWidth = 3 * scale;
          
          for (let i = 0; i < peaks.length; i++) {
            const x = margin.left + (i / peaks.length) * plotWidth;
            const normalizedY = (peaks[i] - yMin) / (yMax - yMin);
            const y = height - margin.bottom - (normalizedY * plotHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          break;
        }
        case 'rms': {
          const rmsValues = [];
          for (let i = 0; i < dataPoints; i++) {
            const startIndex = i * step;
            const endIndex = Math.min(startIndex + step, audioData.length);
            let sum = 0;
            for (let j = startIndex; j < endIndex; j++) {
              sum += audioData[j] * audioData[j];
            }
            const rms = Math.sqrt(sum / (endIndex - startIndex));
            rmsValues.push(20 * Math.log10(Math.max(rms, 1e-10)));
          }

          const minDb = Math.min(...rmsValues);
          const maxDb = Math.max(...rmsValues);
          const yMin = minDb - 5;
          const yMax = maxDb + 5;

          drawAxes('Time', 'RMS Level', yMin, yMax, ' dB');
          
          ctx.beginPath();
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 3 * scale;
          
          for (let i = 0; i < rmsValues.length; i++) {
            const x = margin.left + (i / rmsValues.length) * plotWidth;
            const normalizedY = (rmsValues[i] - yMin) / (yMax - yMin);
            const y = height - margin.bottom - (normalizedY * plotHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          break;
        }
        case 'lufs': {
          const lufsValues = [];
          let integratedLoudness = 0;
          
          for (let i = 0; i < dataPoints; i++) {
            const startIndex = i * step;
            const endIndex = Math.min(startIndex + step, audioData.length);
            let sum = 0;
            
            for (let j = startIndex; j < endIndex; j++) {
              sum += audioData[j] * audioData[j];
            }
            const rms = Math.sqrt(sum / (endIndex - startIndex));
            const lufs = -0.691 + 10 * Math.log10(Math.max(rms, 1e-10));
            integratedLoudness = integratedLoudness * 0.95 + lufs * 0.05;
            lufsValues.push(integratedLoudness);
          }
          
          const minLufs = Math.min(...lufsValues);
          const maxLufs = Math.max(...lufsValues);
          const yMin = Math.min(minLufs - 5, -60);
          const yMax = Math.max(maxLufs + 5, 0);
          
          drawAxes('Time', 'LUFS Loudness', yMin, yMax, ' LUFS');
          
          ctx.beginPath();
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 3 * scale;
          
          for (let i = 0; i < lufsValues.length; i++) {
            const x = margin.left + (i / lufsValues.length) * plotWidth;
            const normalizedY = (lufsValues[i] - yMin) / (yMax - yMin);
            const y = height - margin.bottom - (normalizedY * plotHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
                     ctx.stroke();
           break;
         }
         case 'spectrogram': {
           // Fast spectrogram using simplified approach
           drawAxes('Time', 'Frequency', 20, 22050, ' Hz');
           
           // Hot/cold color mapping function
           const getSpectrogramColor = (intensity: number) => {
             const normalizedIntensity = Math.pow(Math.max(0, Math.min(1, intensity)), 0.3);
             
             if (normalizedIntensity < 0.01) {
               return 'rgba(5, 5, 5, 1)';
             } else if (normalizedIntensity < 0.2) {
               const t = normalizedIntensity / 0.2;
               return `rgb(${Math.floor(t * 20)}, ${Math.floor(t * 40)}, ${Math.floor(80 + t * 175)})`;
             } else if (normalizedIntensity < 0.4) {
               const t = (normalizedIntensity - 0.2) / 0.2;
               return `rgb(${Math.floor(t * 60)}, ${Math.floor(120 + t * 135)}, 255)`;
             } else if (normalizedIntensity < 0.6) {
               const t = (normalizedIntensity - 0.4) / 0.2;
               return `rgb(${Math.floor(60 + t * 60)}, 255, ${Math.floor(255 - t * 155)})`;
             } else if (normalizedIntensity < 0.8) {
               const t = (normalizedIntensity - 0.6) / 0.2;
               return `rgb(${Math.floor(120 + t * 135)}, 255, ${Math.floor(100 - t * 100)})`;
             } else {
               const t = (normalizedIntensity - 0.8) / 0.2;
               return `rgb(255, ${Math.floor(255 - t * 80)}, ${Math.floor(t * 160)})`;
             }
           };

           try {
             // Use simplified approach to avoid freezing
             const timeSteps = Math.min(150, Math.floor(plotWidth / 4));
             const freqBins = 64;
             const stepSize = Math.floor(audioData.length / timeSteps);
             const windowSize = Math.min(1024, stepSize * 2);
             
             // Pre-calculate frequency mapping
             const logMinFreq = Math.log10(20);
             const logMaxFreq = Math.log10(22050);
             
             for (let t = 0; t < timeSteps; t++) {
               const startIndex = t * stepSize;
               const segment = audioData.slice(startIndex, startIndex + windowSize);
               
               if (segment.length === 0) continue;
               
               // Simple power spectrum calculation
               const frequencies = new Float32Array(freqBins);
               let maxMag = 0;
               
               for (let f = 0; f < freqBins; f++) {
                 let real = 0;
                 let imag = 0;
                 const freq = Math.pow(10, logMinFreq + (f / freqBins) * (logMaxFreq - logMinFreq));
                 const binFreq = (freq / 22050) * (windowSize / 2);
                 
                 for (let i = 0; i < Math.min(segment.length, 128); i += 4) {
                   const angle = 2 * Math.PI * binFreq * i / windowSize;
                   real += segment[i] * Math.cos(angle);
                   imag += segment[i] * Math.sin(angle);
                 }
                 
                 const magnitude = Math.sqrt(real * real + imag * imag) / segment.length;
                 frequencies[f] = magnitude;
                 maxMag = Math.max(maxMag, magnitude);
               }
               
               // Draw frequency column
               const x = margin.left + (t / timeSteps) * plotWidth;
               const pixelWidth = Math.max(1, plotWidth / timeSteps);
               
               for (let f = 0; f < freqBins; f++) {
                 const intensity = maxMag > 0 ? frequencies[f] / maxMag : 0;
                 
                 if (intensity > 0.001) {
                   const y = height - margin.bottom - ((f / freqBins) * plotHeight);
                   const pixelHeight = Math.max(1, plotHeight / freqBins);
                   
                   ctx.fillStyle = getSpectrogramColor(intensity);
                   ctx.fillRect(x, y - pixelHeight, pixelWidth, pixelHeight);
                 }
               }
             }
           } catch (error) {
             logger.warn('Spectrogram calculation error:', error);
             ctx.fillStyle = '#6B7280';
             ctx.font = `${Math.round(18 * scale)}px sans-serif`;
             ctx.textAlign = 'center';
             ctx.fillText('Spectrogram processing...', width / 2, height / 2);
           }
           
           break;
         }
         case 'dynamics': {
          const dynamicsMetrics = metrics || calculateAudioMetrics(audioData);
          
          if (dynamicsMetrics) {
            ctx.fillStyle = '#374151';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Audio Dynamics Analysis', width / 2, margin.top + 15);
            
            const metricsData = [
              { label: 'Peak Level', value: dynamicsMetrics.peakLevel, unit: ' dB', color: '#DC2626' },
              { label: 'RMS Level', value: dynamicsMetrics.rmsLevel, unit: ' dB', color: '#059669' },
              { label: 'Crest Factor', value: dynamicsMetrics.crestFactor, unit: ' dB', color: '#7C3AED' },
              { label: 'Dynamic Range', value: dynamicsMetrics.dynamicRange, unit: ' dB', color: '#EA580C' }
            ];

            const barHeight = 40;
            const barSpacing = 15;
            const maxBarWidth = plotWidth - 250;
            const startY = margin.top + 50;
            
            metricsData.forEach((metric, i) => {
              const y = startY + i * (barHeight + barSpacing);
              
              ctx.fillStyle = '#374151';
              ctx.font = `${Math.round(14 * scale)}px sans-serif`;
              ctx.textAlign = 'left';
              ctx.fillText(metric.label, margin.left, y + 20);
              
              ctx.fillStyle = metric.color;
              const normalizedValue = Math.max(0, Math.min(1, (metric.value + 60) / 60));
              const barWidth = normalizedValue * maxBarWidth;
              ctx.fillRect(margin.left + 120, y, barWidth, barHeight);
              
              ctx.fillStyle = '#374151';
              ctx.textAlign = 'right';
              ctx.fillText(`${metric.value.toFixed(1)}${metric.unit}`, width - margin.right, y + 25);
            });
          }
          break;
        }
      }
    };

    drawVisualization();
  }, [audioData, visualizationMode, scale, metrics]);

  const handlePlayPause = () => {
    logger.info('🎮 Play button clicked', {
      hasWaveSurfer: !!wavesurferRef.current,
      isReady: isWaveSurferReady,
      isPlaying
    });
    
    if (!wavesurferRef.current) {
      logger.error('❌ WaveSurfer not initialized');
      return;
    }
    
    if (!isWaveSurferReady) {
      logger.warn('⚠️ WaveSurfer not ready yet');
      return;
    }
    
    try {
      wavesurferRef.current.playPause();
    } catch (error) {
      logger.error('❌ Error playing/pausing:', error);
    }
  };

  const handleZoom = (delta: number) => {
    if (visualizationMode === 'waveform') {
      // WaveSurfer zoom
    if (!wavesurferRef.current) return;
      const newZoom = Math.max(1, Math.min(100, zoom + delta));
      wavesurferRef.current.zoom(newZoom);
    } else {
      // Canvas visualization scale
      const newScale = Math.max(0.5, Math.min(3, scale + delta * 0.1));
      setScale(newScale);
    }
  };

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4">
      {/* Mobile-friendly controls layout */}
      <div className={`mb-4 ${isMobile ? 'space-y-3' : 'flex items-center justify-between'}`}>
        {/* Primary controls */}
        <div className={`flex items-center ${isMobile ? 'justify-between' : 'space-x-4'}`}>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePlayPause}
              disabled={!isWaveSurferReady || visualizationMode !== 'waveform'}
              className={`${isMobile ? 'p-3' : 'p-2'} rounded-full transition-colors ${
                isWaveSurferReady && visualizationMode === 'waveform'
                  ? 'bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800' 
                  : 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              {isPlaying ? (
                <svg className={`${isMobile ? 'w-7 h-7' : 'w-6 h-6'} text-indigo-600 dark:text-indigo-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className={`${isMobile ? 'w-7 h-7' : 'w-6 h-6'} text-indigo-600 dark:text-indigo-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </button>
            <span className={`${isMobile ? 'text-sm' : 'text-sm'} text-gray-600 dark:text-gray-400 font-mono`}>
              {formatTime(currentTime)}
            </span>
          </div>
          
          {/* Visualization Mode Selector */}
          <select
            value={visualizationMode}
            onChange={(e) => setVisualizationMode(e.target.value as VisualizationMode)}
            className={`border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              isMobile ? 'px-2 py-2 text-sm' : 'px-3 py-1 text-sm'
            }`}
          >
            <option value="waveform">Waveform</option>
            <option value="peaks">Peak Levels</option>
            <option value="rms">RMS Levels</option>
            <option value="lufs">LUFS Loudness</option>
            <option value="spectrogram">Spectrogram</option>
            <option value="dynamics">Dynamics</option>
          </select>
        </div>
        
        {/* Secondary controls */}
        <div className={`flex items-center ${isMobile ? 'justify-center flex-wrap gap-2' : 'space-x-2'}`}>
          {/* Scale/Zoom Controls */}
          {visualizationMode !== 'waveform' && (
            <div className="flex items-center space-x-1">
              <span className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400 mr-1`}>Scale:</span>
              <button
                onClick={() => handleScaleChange(0.5)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  scale === 0.5 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                50%
              </button>
              <button
                onClick={() => handleScaleChange(1)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  scale === 1 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                100%
              </button>
              <button
                onClick={() => handleScaleChange(1.5)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  scale === 1.5 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                150%
              </button>
              <button
                onClick={() => handleScaleChange(2)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  scale === 2 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                200%
              </button>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleZoom(-10)}
              className={`${isMobile ? 'p-2' : 'p-1'} rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors`}
              aria-label="Zoom out"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-gray-600 dark:text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={() => handleZoom(10)}
              className={`${isMobile ? 'p-2' : 'p-1'} rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors`}
              aria-label="Zoom in"
            >
              <svg className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-gray-600 dark:text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Visualization area */}
      <div className="relative">
        {/* WaveSurfer container - only visible for waveform mode */}
        <div 
          ref={containerRef} 
          className={`w-full ${visualizationMode === 'waveform' ? 'block' : 'hidden'}`} 
        />
        
        {/* Canvas for other visualizations */}
        <canvas
          ref={canvasRef}
          className={`w-full border border-gray-200 dark:border-gray-600 rounded ${visualizationMode !== 'waveform' ? 'block' : 'hidden'}`}
          style={{ 
            height: isMobile ? '300px' : '400px',
            imageRendering: 'crisp-edges'
          }}
        />
        
        {/* Loading states */}
        {!isWaveSurferReady && audioData && visualizationMode === 'waveform' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded">
            <div className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-sm' : 'text-base'} flex items-center`}>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading waveform...
            </div>
          </div>
        )}
        
        {/* Help text for visualizations */}
        {visualizationMode !== 'waveform' && (
          <div className={`mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 ${isMobile ? 'text-xs' : 'text-sm'} text-blue-800 dark:text-blue-200`}>
            {visualizationMode === 'peaks' && 'Shows audio peak levels over time. Higher peaks indicate louder sections. Professional audio typically keeps peaks below 0 dB to avoid clipping.'}
            {visualizationMode === 'rms' && 'Shows RMS (Root Mean Square) levels over time, representing perceived loudness. RMS gives a better indication of how loud audio will sound to listeners.'}
            {visualizationMode === 'lufs' && 'Shows LUFS (Loudness Units Full Scale) measurements over time for broadcast standards. Used by streaming platforms to normalize content loudness.'}
            {visualizationMode === 'spectrogram' && 'Shows frequency content over time. Colors represent intensity: blue (low), green (medium), red (high). Useful for identifying frequency balance and spectral characteristics.'}
            {visualizationMode === 'dynamics' && 'Shows a comparative analysis of the audio dynamic characteristics including peak levels, RMS, crest factor, and dynamic range.'}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, totalSize - 8, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write the PCM samples
  const offset = 44;
  const channelData = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  let pos = 0;
  while (pos < buffer.length) {
    for (let i = 0; i < numChannels; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i][pos]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + pos * blockAlign + i * bytesPerSample, val, true);
    }
    pos++;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export default WaveformVisualizer; 