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

  // Clean professional color palette
  const textPrimary = rgb(0.067, 0.067, 0.067);        // #111111 - Almost black
  const textSecondary = rgb(0.439, 0.439, 0.439);      // #707070 - Secondary text
  const textMuted = rgb(0.667, 0.667, 0.667);          // #AAAAAA - Muted text
  const white = rgb(1, 1, 1);                          // #FFFFFF - Pure white

  // Professional spacing system
  const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 32,
    xxl: 48
  };

  const margin = spacing.xl;
  const contentWidth = width - (margin * 2);
  const columnWidth = contentWidth / 12;

  // Clean section drawing without background elements
  const drawSection = (x: number, y: number, sectionWidth: number, sectionHeight: number, title: string) => {
    // Simple section title without background or borders
    page.drawText(title, {
      x: x + spacing.md,
      y: y - spacing.md,
      size: 16,
      font: helveticaBold,
      color: textPrimary,
    });

    return y - spacing.lg - spacing.md;
  };

  // New helper function for consistent two-column grid layout
  const drawTwoColumnGrid = (
    x: number, 
    y: number, 
    data: Array<[string, string, boolean?]>, // [label, value, isHighlighted?]
    options: {
      labelWidth?: number;
      fontSize?: number;
      rowHeight?: number;
      highlightBg?: boolean;
    } = {}
  ) => {
    const { 
      labelWidth = 100, 
      fontSize = 11, 
      rowHeight = 22,
      highlightBg = false 
    } = options;

    data.forEach((item, index) => {
      const [label, value, isHighlighted = false] = item;
      const xPos = x + (index % 2) * (columnWidth * 6);
      const yPos = y - Math.floor(index / 2) * rowHeight;

      // Background highlight for important values
      if (isHighlighted && highlightBg) {
        page.drawRectangle({
          x: xPos + 6,
          y: yPos - 6,
          width: 200,
          height: 18,
          color: rgb(0.95, 0.95, 0.95),
        });
      }

      // Label with consistent styling
      page.drawText(label, {
        x: xPos + 10,
        y: yPos,
        size: fontSize - 1,
        font: helvetica,
        color: textSecondary,
      });

      // Value with enhanced styling and conditional highlighting
      page.drawText(value, {
        x: xPos + labelWidth,
        y: yPos,
        size: fontSize,
        font: isHighlighted ? helveticaBold : helvetica,
        color: isHighlighted ? textPrimary : textPrimary,
      });
    });

    return y - Math.ceil(data.length / 2) * rowHeight;
  };



  // Generate unique report ID
  const fileHash = fileName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const reportTimestamp = Date.now();
  const fileComponent = Math.abs(fileHash % 10000).toString().padStart(4, '0');
  const timeComponent = (reportTimestamp % 100000000).toString().padStart(8, '0');
  const reportId = `RPT-${fileComponent}-${timeComponent}`;

  // CLEAN HEADER without background elements
  let yPosition = height - 30;

  // Simple branding without background effects
  page.drawText('LUFALYZE', {
    x: margin,
    y: yPosition - 25,
    size: 36,
    font: helveticaBold,
    color: textPrimary,
  });

  page.drawText('Professional Audio Analysis Report', {
    x: margin,
    y: yPosition - 48,
    size: 13,
    font: helvetica,
    color: textPrimary,
  });

  // Enhanced metadata presentation
  const now = new Date();
  const timestamp = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // No background rectangle for clean look

  page.drawText('Report ID', {
    x: width - 170,
    y: yPosition - 35,
    size: 8,
    font: helvetica,
    color: textSecondary,
  });

  page.drawText(reportId, {
    x: width - 170,
    y: yPosition - 45,
    size: 10,
    font: courier,
    color: textPrimary,
  });

  page.drawText('Generated', {
    x: width - 170,
    y: yPosition - 55,
    size: 8,
    font: helvetica,
    color: textSecondary,
  });

  page.drawText(timestamp, {
    x: width - 170,
    y: yPosition - 65,
    size: 9,
    font: helvetica,
    color: textPrimary,
  });

  yPosition -= 120;

  // Get integrated loudness for use throughout the document
  const integratedLufs = metrics.loudnessDetailed?.integrated || metrics.loudness;

  // AUDIO FILE INFO with enhanced two-column grid
  const fileInfoY = drawSection(margin, yPosition, contentWidth, 90, 'Audio File Information');
  yPosition = fileInfoY - spacing.sm;

  const fileData: Array<[string, string, boolean?]> = [
    ['File Name:', fileName, true],
    ['Format:', metrics.audioFileInfo?.format || 'Unknown'],
    ['Duration:', metrics.duration ? formatDuration(metrics.duration) : 'Unknown'],
    ['Sample Rate:', metrics.audioFileInfo?.sampleRate ? `${(metrics.audioFileInfo.sampleRate / 1000).toFixed(1)} kHz` : 'Unknown'],
    ['Channels:', metrics.audioFileInfo?.channels === 1 ? 'Mono' : 'Stereo'],
    ['File Size:', metrics.fileSize ? formatFileSize(metrics.fileSize) : 'Unknown'],
  ];

  yPosition = drawTwoColumnGrid(margin + spacing.md, yPosition, fileData, {
    labelWidth: 100,
    fontSize: 11,
    rowHeight: 24,
    highlightBg: true
  });

  yPosition -= 20;

  // LOUDNESS ANALYSIS with enhanced presentation
  const loudnessY = drawSection(margin, yPosition, contentWidth, 200, 'Loudness Analysis (EBU R 128)');
  yPosition = loudnessY - spacing.sm;

  // Enhanced loudness metrics with two-column grid
  const loudnessData: Array<[string, string, boolean?]> = [
    ['Integrated:', `${integratedLufs.toFixed(1)} LUFS`, true],
    ['Momentary Max:', metrics.loudnessDetailed ? `${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS` : 'N/A'],
    ['Short-Term Max:', metrics.loudnessDetailed ? `${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS` : 'N/A'],
    ['RMS Level:', `${metrics.rms.toFixed(1)} dB`],
  ];

  yPosition = drawTwoColumnGrid(margin + spacing.md, yPosition, loudnessData, {
    labelWidth: 120,
    fontSize: 12,
    rowHeight: 26,
    highlightBg: true
  });

  yPosition -= 30;

  // MUSICAL ANALYSIS with enhanced presentation
  if (metrics.musicAnalysis) {
    const musicY = drawSection(margin, yPosition, contentWidth, 80, 'Musical Analysis');
    yPosition = musicY - spacing.sm;

    const musicalData: Array<[string, string, boolean?]> = [
      ['Musical Key:', metrics.musicAnalysis.key, true],
      ['Root Note:', metrics.musicAnalysis.root_note],
      ['Confidence:', `${(metrics.musicAnalysis.confidence * 100).toFixed(0)}%`],
      ['Tempo:', metrics.tempo ? `${metrics.tempo} BPM` : 'Unknown', metrics.tempo ? true : false],
    ];

    yPosition = drawTwoColumnGrid(margin + spacing.md, yPosition, musicalData, {
      labelWidth: 100,
      fontSize: 12,
      rowHeight: 24,
      highlightBg: true
    });

    yPosition -= 20;
  }

  // Add spacing before footer
  yPosition -= spacing.xxl;

  // CLEAN FOOTER without background elements

  // Enhanced legal disclaimer for protection
  page.drawText('© 2025 Lufalyze | This report is for informational purposes only and does not constitute professional', {
    x: margin,
    y: 45,
    size: 8,
    font: helvetica,
    color: textMuted,
  });

  page.drawText('advice or certification. Results are based on automated analysis and may contain errors. User assumes', {
    x: margin,
    y: 35,
    size: 8,
    font: helvetica,
    color: textMuted,
  });

  page.drawText('all responsibility for verification and use of this information. No warranties expressed or implied.', {
    x: margin,
    y: 25,
    size: 8,
    font: helvetica,
    color: textMuted,
  });

  page.drawText('lufalyze.com | Professional Audio Analysis Platform', {
    x: margin,
    y: 12,
    size: 9,
    font: helveticaBold,
    color: textSecondary,
  });

  // Simple report ID without box
  page.drawText(`${reportId}`, {
    x: width - 140,
    y: 25,
    size: 9,
    font: courier,
    color: textPrimary,
  });

  // Serialize the PDF document to bytes
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
} 