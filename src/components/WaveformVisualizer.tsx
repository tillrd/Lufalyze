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

  const calculateRMS = (data: Float32Array): number => {
    return Math.sqrt(data.reduce((acc, val) => acc + val * val, 0) / data.length);
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
      const time = (duration * i) / timeMarkers;
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ctx.fillText(timeText, x, height - padding + 20);
    }

    // Draw amplitude scale
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight * i) / 4;
      const amplitude = (1 - i / 4).toFixed(1);
      ctx.fillText(amplitude, padding - 5, y + 4);
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
        amplitude = calculateRMS(block);
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
      const minutes = Math.floor(hoveredTime / 60);
      const seconds = Math.floor(hoveredTime % 60);
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      const amplitudeText = hoveredAmplitude.toFixed(3);

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