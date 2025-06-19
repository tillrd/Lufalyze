import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

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

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export async function generatePDFReport(
  metrics: Metrics,
  fileName: string = 'Unknown File'
): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();

  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  // Professional color palette
  const primary = rgb(0.129, 0.129, 0.129);        // #212121 - Professional dark
  const accent = rgb(0.259, 0.522, 0.956);         // #4285F4 - Professional blue
  const success = rgb(0.043, 0.522, 0.043);        // #0B850B - Success green
  const error = rgb(0.827, 0.184, 0.184);          // #D32F2F - Error red
  const lightGray = rgb(0.976, 0.976, 0.976);      // #F9F9F9 - Very light gray
  const mediumGray = rgb(0.929, 0.929, 0.929);     // #EDEDED - Medium gray
  const darkGray = rgb(0.502, 0.502, 0.502);       // #808080 - Dark gray
  const white = rgb(1, 1, 1);                      // #FFFFFF - Pure white

  // Helper function for professional spacing
  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  };

  const margin = spacing.xl;
  const contentWidth = width - (margin * 2);

  // Helper function to draw professional sections
  const drawSection = (x: number, y: number, sectionWidth: number, sectionHeight: number, title: string) => {
    // Section background
    page.drawRectangle({
      x: x - spacing.md,
      y: y - sectionHeight - spacing.md,
      width: sectionWidth + (spacing.md * 2),
      height: sectionHeight + (spacing.lg),
      color: white,
    });

    // Section border (subtle)
    page.drawRectangle({
      x: x - spacing.md,
      y: y - sectionHeight - spacing.md,
      width: sectionWidth + (spacing.md * 2),
      height: sectionHeight + (spacing.lg),
      borderColor: mediumGray,
      borderWidth: 0.5,
    });

    // Section title
    page.drawText(title, {
      x: x,
      y: y,
      size: 13,
      font: helveticaBold,
      color: accent,
    });

    return y - spacing.lg;
  };

  // Professional Header with Brand Identity
  let yPosition = height - 40;
  
  // Header background with subtle gradient effect
  page.drawRectangle({
    x: 0,
    y: yPosition - 70,
    width: width,
    height: 80,
    color: lightGray,
  });

  // Header accent bar
  page.drawRectangle({
    x: 0,
    y: yPosition - 70,
    width: width,
    height: 4,
    color: accent,
  });

  // Brand section
  page.drawText('LUFALYZE', {
    x: margin,
    y: yPosition - 20,
    size: 32,
    font: helveticaBold,
    color: accent,
  });

  page.drawText('PROFESSIONAL AUDIO ANALYSIS REPORT', {
    x: margin,
    y: yPosition - 45,
    size: 12,
    font: helvetica,
    color: primary,
  });

  // Certificate metadata (right aligned)
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Certificate number (based on file name hash)
  const certNumber = fileName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const reportId = `RPT-${Math.abs(certNumber).toString().padStart(8, '0')}`;
  
  page.drawText('Report ID:', {
    x: width - 200,
    y: yPosition - 20,
    size: 9,
    font: helvetica,
    color: darkGray,
  });
  
  page.drawText(reportId, {
    x: width - 200,
    y: yPosition - 33,
    size: 11,
    font: courier,
    color: primary,
  });

  page.drawText('Generated:', {
    x: width - 200,
    y: yPosition - 50,
    size: 9,
    font: helvetica,
    color: darkGray,
  });
  
  page.drawText(timestamp, {
    x: width - 200,
    y: yPosition - 63,
    size: 9,
    font: helvetica,
    color: primary,
  });

  yPosition -= 110;

  // File Information Section
  const fileInfoY = drawSection(margin, yPosition, contentWidth, 90, 'AUDIO FILE INFORMATION');
  yPosition = fileInfoY - spacing.sm;

  const fileInfo = [
    ['File Name:', fileName],
    ['Format:', metrics.audioFileInfo?.format || 'Unknown'],
    ['Duration:', metrics.duration ? formatDuration(metrics.duration) : 'Unknown'],
    ['Sample Rate:', metrics.audioFileInfo?.sampleRate ? `${metrics.audioFileInfo.sampleRate.toLocaleString()} Hz` : 'Unknown'],
    ['Channels:', metrics.audioFileInfo?.channels ? `${metrics.audioFileInfo.channels} (${metrics.audioFileInfo.channels === 1 ? 'Mono' : 'Stereo'})` : 'Unknown'],
    ['File Size:', metrics.fileSize ? formatFileSize(metrics.fileSize) : 'Unknown'],
  ];

  // Split into two columns for better layout
  const leftColumn = fileInfo.slice(0, 3);
  const rightColumn = fileInfo.slice(3);

  leftColumn.forEach(([label, value], index) => {
    page.drawText(label, {
      x: margin + spacing.sm,
      y: yPosition - (index * 18),
      size: 10,
      font: helveticaBold,
      color: darkGray,
    });
    page.drawText(value, {
      x: margin + 140,
      y: yPosition - (index * 18),
      size: 10,
      font: helvetica,
      color: primary,
    });
  });

  rightColumn.forEach(([label, value], index) => {
    page.drawText(label, {
      x: margin + 300,
      y: yPosition - (index * 18),
      size: 10,
      font: helveticaBold,
      color: darkGray,
    });
    page.drawText(value, {
      x: margin + 420,
      y: yPosition - (index * 18),
      size: 10,
      font: helvetica,
      color: primary,
    });
  });

  yPosition -= 120;

  // Loudness Analysis Section
  const loudnessY = drawSection(margin, yPosition, contentWidth, 110, 'LOUDNESS ANALYSIS (EBU R 128 / ITU-R BS.1770-4)');
  yPosition = loudnessY - spacing.sm;

  // Main LUFS value (prominently displayed)
  const integratedLufs = metrics.loudnessDetailed?.integrated || metrics.loudness;
  
  // LUFS value box
  page.drawRectangle({
    x: margin + spacing.sm,
    y: yPosition - 60,
    width: 150,
    height: 50,
    color: lightGray,
    borderColor: accent,
    borderWidth: 1,
  });

  page.drawText(`${integratedLufs.toFixed(1)}`, {
    x: margin + spacing.sm + 15,
    y: yPosition - 30,
    size: 24,
    font: helveticaBold,
    color: accent,
  });

  page.drawText('LUFS', {
    x: margin + spacing.sm + 90,
    y: yPosition - 30,
    size: 16,
    font: helvetica,
    color: accent,
  });

  page.drawText('Integrated Loudness', {
    x: margin + spacing.sm + 15,
    y: yPosition - 50,
    size: 9,
    font: helvetica,
    color: darkGray,
  });

  // Additional loudness metrics
  if (metrics.loudnessDetailed) {
    const loudnessMetrics = [
      ['Momentary Max:', `${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS`],
      ['Short Term Max:', `${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS`],
      ['RMS Level:', `${metrics.rms.toFixed(1)} dB`],
    ];

    loudnessMetrics.forEach(([label, value], index) => {
      page.drawText(label, {
        x: margin + 200,
        y: yPosition - 15 - (index * 18),
        size: 10,
        font: helveticaBold,
        color: darkGray,
      });
      page.drawText(value, {
        x: margin + 320,
        y: yPosition - 15 - (index * 18),
        size: 10,
        font: helvetica,
        color: primary,
      });
    });
  }

  // Platform target comparison
  const platforms = [
    { name: 'Spotify', target: -14 },
    { name: 'YouTube', target: -14 },
    { name: 'Apple Music', target: -16 },
    { name: 'Netflix', target: -27 },
  ];

  page.drawText('Platform Targets:', {
    x: margin + 400,
    y: yPosition - 15,
    size: 11,
    font: helveticaBold,
    color: primary,
  });

  platforms.forEach((platform, index) => {
    const difference = integratedLufs - platform.target;
    const diffText = difference > 0 ? `+${difference.toFixed(1)} dB` : `${difference.toFixed(1)} dB`;
    const diffColor = Math.abs(difference) <= 1 ? success : 
                     Math.abs(difference) <= 3 ? rgb(0.855, 0.647, 0.125) : // Amber for moderate difference
                     rgb(0.737, 0.561, 0.561); // Muted red for larger difference
    
    page.drawText(`${platform.name}:`, {
      x: margin + 400,
      y: yPosition - 35 - (index * 16),
      size: 9,
      font: helvetica,
      color: darkGray,
    });
    page.drawText(diffText, {
      x: margin + 480,
      y: yPosition - 35 - (index * 16),
      size: 9,
      font: helveticaBold,
      color: diffColor,
    });
  });

  yPosition -= 140;

  // Musical Analysis Section (if available)
  if (metrics.musicAnalysis) {
    const musicY = drawSection(margin, yPosition, contentWidth, 90, 'MUSICAL ANALYSIS');
    yPosition = musicY - spacing.sm;

    // Key detection box
    page.drawRectangle({
      x: margin + spacing.sm,
      y: yPosition - 50,
      width: 120,
      height: 40,
      color: lightGray,
      borderColor: accent,
      borderWidth: 1,
    });

    page.drawText(`${metrics.musicAnalysis.key}`, {
      x: margin + spacing.sm + 10,
      y: yPosition - 25,
      size: 18,
      font: helveticaBold,
      color: accent,
    });

    page.drawText('Detected Key', {
      x: margin + spacing.sm + 10,
      y: yPosition - 40,
      size: 8,
      font: helvetica,
      color: darkGray,
    });

    // Musical metrics
    const musicMetrics = [
      ['Root Note:', metrics.musicAnalysis.root_note],
      ['Scale:', metrics.musicAnalysis.is_major ? 'Major' : 'Minor'],
      ['Confidence:', `${(metrics.musicAnalysis.confidence * 100).toFixed(1)}%`],
    ];

    musicMetrics.forEach(([label, value], index) => {
      page.drawText(label, {
        x: margin + 180,
        y: yPosition - 15 - (index * 18),
        size: 10,
        font: helveticaBold,
        color: darkGray,
      });
      page.drawText(value, {
        x: margin + 270,
        y: yPosition - 15 - (index * 18),
        size: 10,
        font: helvetica,
        color: primary,
      });
    });

    // Tempo (if available)
    if (metrics.tempo) {
      page.drawRectangle({
        x: margin + 380,
        y: yPosition - 50,
        width: 100,
        height: 40,
        color: lightGray,
        borderColor: accent,
        borderWidth: 1,
      });

      page.drawText(`${metrics.tempo}`, {
        x: margin + 390,
        y: yPosition - 25,
        size: 16,
        font: helveticaBold,
        color: accent,
      });

      page.drawText('BPM', {
        x: margin + 440,
        y: yPosition - 25,
        size: 12,
        font: helvetica,
        color: accent,
      });

      page.drawText('Tempo', {
        x: margin + 390,
        y: yPosition - 40,
        size: 8,
        font: helvetica,
        color: darkGray,
      });
    }

    yPosition -= 120;
  }

  // Performance Metrics Section
  const perfY = drawSection(margin, yPosition, contentWidth, 70, 'PROCESSING PERFORMANCE');
  yPosition = perfY - spacing.sm;

  const performanceMetrics = [
    ['Processing Time:', metrics.processingTime ? `${(metrics.processingTime / 1000).toFixed(2)}s` : 'Unknown'],
    ['Analysis Speed:', metrics.processingTime && metrics.duration ? `${(metrics.duration / (metrics.processingTime / 1000)).toFixed(1)}x realtime` : 'Unknown'],
    ['Total Analysis Time:', `${metrics.performance.totalTime.toFixed(2)}ms`],
  ];

  performanceMetrics.forEach(([label, value], index) => {
    page.drawText(label, {
      x: margin + spacing.sm,
      y: yPosition - 15 - (index * 18),
      size: 10,
      font: helveticaBold,
      color: darkGray,
    });
    page.drawText(value, {
      x: margin + 160,
      y: yPosition - 15 - (index * 18),
      size: 10,
      font: helvetica,
      color: primary,
    });
  });

  yPosition -= 100;

  // Footer Section
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 80,
    color: lightGray,
  });

  // Footer accent bar
  page.drawRectangle({
    x: 0,
    y: 76,
    width: width,
    height: 4,
    color: accent,
  });

  // Analysis disclaimer
  page.drawText('ANALYSIS DISCLAIMER', {
    x: margin,
    y: 55,
    size: 10,
    font: helveticaBold,
    color: accent,
  });

  const disclaimerText = [
    'This report documents automated audio analysis using Lufalyze software implementing EBU R 128',
    'and ITU-R BS.1770-4 standards. Results are for informational purposes only and do not constitute',
    'official certification or guarantee compliance with any regulatory requirements.'
  ];

  disclaimerText.forEach((line, index) => {
    page.drawText(line, {
      x: margin,
      y: 40 - (index * 10),
      size: 8,
      font: helvetica,
      color: primary,
    });
  });

  // Footer branding
  page.drawText(`lufalyze.com • Report ID: ${reportId}`, {
    x: width - 250,
    y: 15,
    size: 8,
    font: courier,
    color: darkGray,
  });

  // Serialize the PDF document to bytes
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
} 