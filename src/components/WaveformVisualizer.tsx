import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  audioData: Float32Array | null;
  isAnalyzing: boolean;
  duration?: number;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioData, isAnalyzing, duration = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const padding = 40; // Space for time markers and amplitude scale
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
    for (let i = 0; i < bars; i++) {
      const start = i * step;
      const end = start + step;
      const block = audioData.slice(start, end);
      const max = Math.max(...block.map(Math.abs));
      const barHeight = max * graphHeight;
      
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

  }, [audioData, duration]);

  return (
    <div className="relative w-full h-64 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      {isAnalyzing && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      )}
    </div>
  );
};

export default WaveformVisualizer; 