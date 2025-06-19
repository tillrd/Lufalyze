/**
 * Lazy-loaded PDF export utility
 * 
 * PERFORMANCE OPTIMIZATION:
 * This file ensures the 168 KiB pdf-lib library is only loaded when users actually
 * export a PDF, rather than being bundled with the main application code.
 * 
 * The dynamic import() statement in generatePDFReportLazy() triggers code splitting,
 * creating a separate chunk that's only downloaded when needed.
 * 
 * This reduces the main bundle size and improves initial page load performance.
 */

// Define Metrics interface to match pdfExport.ts
interface Metrics {
  loudness: number;
  loudnessDetailed?: {
    momentaryMax: number;
    shortTermMax: number;
    integrated: number;
  };
  rms: number;
  performance: {
    totalTime: number;
    kWeightingTime: number;
    blockProcessingTime: number;
  };
  processingTime?: number;
  fileSize?: number;
  duration?: number;
  audioFileInfo?: {
    fileName: string;
    fileSize: number;
    duration: number;
    sampleRate: number;
    channels: number;
    bitDepth?: number;
    bitrate?: number;
    format: string;
    encoding?: string;
    lastModified?: number;
  };
  tempo?: number;
  musicAnalysis?: {
    key: string;
    root_note: string;
    is_major: boolean;
    confidence: number;
    tonal_clarity: number;
    harmonic_complexity: number;
    chroma: number[];
    scales: Array<{name: string; strength: number; category?: string}>;
  };
}

// Lazy load the PDF export functionality
export const generatePDFReportLazy = async (metrics: Metrics, fileName: string): Promise<Uint8Array> => {
  // Dynamic import of the heavy PDF generation module
  const { generatePDFReport } = await import('./pdfExport');
  
  return generatePDFReport(metrics, fileName);
};

// Pre-load the PDF module when user hovers over export button (smart preloading)
export const preloadPDFModule = async (): Promise<void> => {
  try {
    await import('./pdfExport');
  } catch (error) {
    // Silently fail preloading - the actual import will handle errors
    console.warn('PDF module preload failed:', error);
  }
}; 