import React, { useEffect, useRef, useState } from 'react';

interface WaveformVisualizerProps {
  audioData: Float32Array | null;
  isAnalyzing: boolean;
  duration?: number;
}

type AnalysisMode = 'peak' | 'rms';

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioData, isAnalyzing, duration = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('peak');
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredAmplitude, setHoveredAmplitude] = useState<number | null>(null);

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toDbFS = (value: number): number => {
    // Convert to dBFS with proper clamping
    if (!isFinite(value) || value <= 0) return -100;
    return Math.max(-100, 20 * Math.log10(value));
  };

  const formatAmplitude = (value: number, mode: AnalysisMode): string => {
    if (mode === 'peak') {
      return value.toFixed(1);
    } else {
      return `${value.toFixed(1)} dBFS`;
    }
  };

  const calculateRMS = (data: Float32Array): number => {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + val * val, 0);
    return Math.sqrt(sum / data.length);
  };

  useEffect(() => {
    if (!audioData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const barWidth = 2;
    const spacing = 1;
    const bars = Math.floor(graphWidth / (barWidth + spacing));
    const step = Math.floor(audioData.length / bars);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines (amplitude)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines (time)
    const timeMarkers = 5;
    for (let i = 0; i <= timeMarkers; i++) {
      const x = padding + (graphWidth * i) / timeMarkers;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw time markers
    ctx.fillStyle = '#6B7280';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    for (let i = 0; i <= timeMarkers; i++) {
      const x = padding + (graphWidth * i) / timeMarkers;
      const timePosition = (duration * i) / timeMarkers;
      const timeText = formatTime(timePosition);
      ctx.fillText(timeText, x, height - padding + 20);
    }

    // Draw amplitude scale
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight * i) / 4;
      let value: number;
      if (analysisMode === 'peak') {
        value = 1 - i / 4;
      } else {
        // For RMS, show dBFS values from 0 to -100
        value = -25 * i;
      }
      const amplitudeText = formatAmplitude(value, analysisMode);
      ctx.fillText(amplitudeText, padding - 5, y + 4);
    }

    // Draw waveform
    let maxAmplitude = 0;
    for (let i = 0; i < bars; i++) {
      const start = i * step;
      const end = start + step;
      const block = audioData.slice(start, end);
      
      let amplitude: number;
      if (analysisMode === 'peak') {
        amplitude = Math.max(...block.map(Math.abs));
      } else {
        const rms = calculateRMS(block);
        amplitude = toDbFS(rms);
        // Normalize to 0-1 range for display
        amplitude = (amplitude + 100) / 100; // Scale from -100 to 0 dBFS
      }
      
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      const barHeight = amplitude * graphHeight;
      
      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(0, height - padding, 0, padding);
      gradient.addColorStop(0, '#4F46E5'); // Indigo
      gradient.addColorStop(0.5, '#818CF8'); // Lighter indigo
      gradient.addColorStop(1, '#C7D2FE'); // Very light indigo
      ctx.fillStyle = gradient;

      // Draw bar
      ctx.fillRect(
        padding + i * (barWidth + spacing),
        height - padding - barHeight,
        barWidth,
        barHeight
      );
    }

    // Draw center line
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();

    // Draw hover information if available
    if (hoveredTime !== null && hoveredAmplitude !== null) {
      const x = padding + (hoveredTime / duration) * graphWidth;
      const y = height - padding - (hoveredAmplitude * graphHeight);
      
      // Draw vertical line
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      // Draw time and amplitude info
      const timeText = formatTime(hoveredTime);
      let amplitudeValue: number;
      if (analysisMode === 'peak') {
        amplitudeValue = hoveredAmplitude;
      } else {
        // Convert normalized value back to dBFS
        amplitudeValue = (hoveredAmplitude * 100) - 100;
      }
      const amplitudeText = formatAmplitude(amplitudeValue, analysisMode);

      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(x - 30, y - 40, 60, 30);
      ctx.fillStyle = 'white';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(timeText, x, y - 25);
      ctx.fillText(amplitudeText, x, y - 15);
    }

  }, [audioData, duration, analysisMode, hoveredTime, hoveredAmplitude]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const padding = 40;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;

    // Calculate time and amplitude
    const time = ((x - padding) / graphWidth) * duration;
    const amplitude = 1 - ((y - padding) / graphHeight);

    if (time >= 0 && time <= duration && amplitude >= 0 && amplitude <= 1) {
      setHoveredTime(time);
      setHoveredAmplitude(amplitude);
    } else {
      setHoveredTime(null);
      setHoveredAmplitude(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
    setHoveredAmplitude(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <button
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            analysisMode === 'peak'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setAnalysisMode('peak')}
        >
          Peak
        </button>
        <button
          className={`px-3 py-1 rounded-md text-sm font-medium ${
            analysisMode === 'rms'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setAnalysisMode('rms')}
        >
          RMS
        </button>
      </div>
      <div className="relative w-full h-64 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        )}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {analysisMode === 'peak' ? (
          <p>Peak amplitude shows the maximum absolute value in each time block.</p>
        ) : (
          <p>RMS (Root Mean Square) shows the average power in each time block.</p>
        )}
      </div>
    </div>
  );
};

export default WaveformVisualizer; 