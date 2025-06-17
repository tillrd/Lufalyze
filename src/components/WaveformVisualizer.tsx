import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  audioData: Float32Array | null;
  isAnalyzing: boolean;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioData, isAnalyzing }) => {
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
    const barWidth = 2;
    const spacing = 1;
    const bars = Math.floor(width / (barWidth + spacing));
    const step = Math.floor(audioData.length / bars);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    for (let i = 0; i < bars; i++) {
      const start = i * step;
      const end = start + step;
      const block = audioData.slice(start, end);
      const max = Math.max(...block.map(Math.abs));
      const barHeight = max * height;
      
      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#4F46E5'); // Indigo
      gradient.addColorStop(1, '#818CF8'); // Lighter indigo
      ctx.fillStyle = gradient;

      // Draw bar
      ctx.fillRect(
        i * (barWidth + spacing),
        height - barHeight,
        barWidth,
        barHeight
      );
    }
  }, [audioData]);

  return (
    <div className="relative w-full h-48 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
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