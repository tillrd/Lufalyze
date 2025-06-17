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
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toDbFS = (value: number): number => {
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !audioData || !duration) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 40;
    const graphWidth = canvas.width - padding * 2;

    // Calculate time position
    const timePosition = ((x - padding) / graphWidth) * duration;
    if (timePosition >= 0 && timePosition <= duration) {
      setHoveredTime(timePosition);
      
      // Calculate amplitude at this position
      const sampleIndex = Math.floor((timePosition / duration) * audioData.length);
      const block = audioData.slice(sampleIndex, sampleIndex + 100);
      let amplitude: number;
      
      if (analysisMode === 'peak') {
        amplitude = Math.max(...block.map(Math.abs));
      } else {
        const rms = calculateRMS(block);
        amplitude = toDbFS(rms);
        amplitude = (amplitude + 100) / 100;
      }
      
      setHoveredAmplitude(amplitude);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
    setHoveredAmplitude(null);
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

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
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
        value = -25 * i;
      }
      const amplitudeText = formatAmplitude(value, analysisMode);
      ctx.fillText(amplitudeText, padding - 5, y + 4);
    }

    // Draw waveform
    const points: { x: number; y: number }[] = [];
    const samples = Math.min(audioData.length, graphWidth);
    const step = Math.floor(audioData.length / samples);

    for (let i = 0; i < samples; i++) {
      const start = i * step;
      const end = start + step;
      const block = audioData.slice(start, end);
      
      let amplitude: number;
      if (analysisMode === 'peak') {
        amplitude = Math.max(...block.map(Math.abs));
      } else {
        const rms = calculateRMS(block);
        amplitude = toDbFS(rms);
        amplitude = (amplitude + 100) / 100;
      }

      const x = padding + (i / samples) * graphWidth;
      const y = height - padding - (amplitude * graphHeight);
      points.push({ x, y });
    }

    // Draw waveform line
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw hover information
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

      // Draw hover point
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw time and amplitude info
      const timeText = formatTime(hoveredTime);
      let amplitudeValue: number;
      if (analysisMode === 'peak') {
        amplitudeValue = hoveredAmplitude;
      } else {
        amplitudeValue = (hoveredAmplitude * 100) - 100;
      }
      const amplitudeText = formatAmplitude(amplitudeValue, analysisMode);

      // Draw tooltip background
      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(x - 30, y - 40, 60, 30);

      // Draw tooltip text
      ctx.fillStyle = 'white';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(timeText, x, y - 25);
      ctx.fillText(amplitudeText, x, y - 15);
    }

  }, [audioData, duration, analysisMode, hoveredTime, hoveredAmplitude]);

  return (
    <div className="relative w-full h-48 bg-gray-50 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      <div className="absolute top-2 right-2 flex gap-2">
        <button
          onClick={() => setAnalysisMode('peak')}
          className={`px-2 py-1 text-xs font-medium rounded ${
            analysisMode === 'peak'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Peak
        </button>
        <button
          onClick={() => setAnalysisMode('rms')}
          className={`px-2 py-1 text-xs font-medium rounded ${
            analysisMode === 'rms'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          RMS
        </button>
      </div>
    </div>
  );
};

export default WaveformVisualizer; 