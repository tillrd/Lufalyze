// No direct import of pdf-lib - use dynamic import for true lazy loading
import type { Metrics } from '../shared/types/metrics';

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
  // Dynamic import of pdf-lib for true lazy loading
  const { PDFDocument, rgb, StandardFonts, PageSizes } = await import('pdf-lib');
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  // Professional color palette
  const colors = {
    primary: rgb(0.067, 0.067, 0.067),        // #111111 - Primary text
    secondary: rgb(0.439, 0.439, 0.439),      // #707070 - Secondary text
    muted: rgb(0.667, 0.667, 0.667),          // #AAAAAA - Muted text
    accent: rgb(0.376, 0.408, 0.973),         // #606CF7 - Accent color
    success: rgb(0.059, 0.569, 0.200),        // #0F9142 - Success
    warning: rgb(0.851, 0.373, 0.008),        // #D95F02 - Warning
    error: rgb(0.863, 0.078, 0.235),          // #DC143C - Error
    light: rgb(0.98, 0.98, 0.98),             // #FAFAFA - Light background
    white: rgb(1, 1, 1),                      // #FFFFFF - White
  };

  // Spacing system
  const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48
  };

  // Page setup
  const margin = 50;
  let currentPage = pdfDoc.addPage(PageSizes.A4);
  let { width, height } = currentPage.getSize();
  let yPosition = height - margin;
  const contentWidth = width - (margin * 2);

  // Helper function to add a new page when needed
  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (yPosition - requiredSpace < margin + 100) { // Keep some margin at bottom
      currentPage = pdfDoc.addPage(PageSizes.A4);
      yPosition = height - margin;
      return true;
    }
    return false;
  };

  // Helper function to draw section headers
  const drawSectionHeader = (title: string, subtitle?: string) => {
    addNewPageIfNeeded(80);
    
    currentPage.drawText(title, {
      x: margin,
      y: yPosition,
      size: 18,
      font: helveticaBold,
      color: colors.primary,
    });
    yPosition -= 30;

    if (subtitle) {
      currentPage.drawText(subtitle, {
        x: margin,
        y: yPosition,
        size: 12,
        font: helvetica,
        color: colors.secondary,
      });
      yPosition -= 25;
    } else {
      yPosition -= 15;
    }

    // Draw a subtle line under the header
    currentPage.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 1,
      color: colors.muted,
    });
    yPosition -= 20;
  };

  // Helper function to draw two-column data
  const drawTwoColumnData = (data: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']>) => {
    const rowHeight = 20;
    const labelWidth = 140;
    const columnWidth = (contentWidth - 40) / 2;

    data.forEach((item, index) => {
      const [label, value, status = 'normal'] = item;
      const col = index % 2;
      const row = Math.floor(index / 2);
      
      const x = margin + (col * (columnWidth + 20));
      const y = yPosition - (row * rowHeight);

      // Ensure we have space for this row
      if (row === 0) addNewPageIfNeeded(Math.ceil(data.length / 2) * rowHeight + 20);

      // Status color
      let valueColor = colors.primary;
      switch (status) {
        case 'success': valueColor = colors.success; break;
        case 'warning': valueColor = colors.warning; break;
        case 'error': valueColor = colors.error; break;
      }

      currentPage.drawText(label, {
        x: x,
        y: y,
        size: 10,
        font: helvetica,
        color: colors.secondary,
      });

      currentPage.drawText(value, {
        x: x + labelWidth,
        y: y,
        size: 10,
        font: helveticaBold,
        color: valueColor,
      });
    });

    yPosition -= Math.ceil(data.length / 2) * rowHeight + 20;
  };

  // Helper function to draw key-value pairs in single column
  const drawKeyValuePairs = (data: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']>) => {
    const rowHeight = 18;
    
    addNewPageIfNeeded(data.length * rowHeight + 20);

    data.forEach((item, index) => {
      const [label, value, status = 'normal'] = item;
      const y = yPosition - (index * rowHeight);

      let valueColor = colors.primary;
      switch (status) {
        case 'success': valueColor = colors.success; break;
        case 'warning': valueColor = colors.warning; break;
        case 'error': valueColor = colors.error; break;
      }

      currentPage.drawText(label, {
        x: margin + 20,
        y: y,
        size: 10,
        font: helvetica,
        color: colors.secondary,
      });

      currentPage.drawText(value, {
        x: margin + 200,
        y: y,
        size: 10,
        font: helveticaBold,
        color: valueColor,
      });
    });

    yPosition -= data.length * rowHeight + 15;
  };

  // Generate report metadata
  const reportId = `LUF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  const timestamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // PAGE 1 - HEADER AND OVERVIEW
  // Main header
  currentPage.drawText('LUFALYZE', {
    x: margin,
    y: yPosition,
    size: 32,
    font: helveticaBold,
    color: colors.primary,
  });

  currentPage.drawText('Professional Audio Analysis Report', {
    x: margin,
    y: yPosition - 35,
    size: 14,
    font: helvetica,
    color: colors.secondary,
  });

  // Report metadata (top right)
  currentPage.drawText('Report ID:', {
    x: width - 180,
    y: yPosition - 10,
    size: 9,
    font: helvetica,
    color: colors.secondary,
  });
  currentPage.drawText(reportId, {
    x: width - 180,
    y: yPosition - 25,
    size: 10,
    font: courier,
    color: colors.primary,
  });
  currentPage.drawText('Generated:', {
    x: width - 180,
    y: yPosition - 45,
    size: 9,
    font: helvetica,
    color: colors.secondary,
  });
  currentPage.drawText(timestamp, {
    x: width - 180,
    y: yPosition - 60,
    size: 9,
    font: helvetica,
    color: colors.primary,
  });

  yPosition -= 100;

  // AUDIO FILE INFORMATION
  drawSectionHeader('Audio File Information');
  
  const fileData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
    ['File Name:', fileName, 'normal'],
    ['Format:', metrics.audioFileInfo?.format || 'Unknown', 'normal'],
    ['Duration:', metrics.duration ? formatDuration(metrics.duration) : 'Unknown', 'normal'],
    ['File Size:', metrics.fileSize ? formatFileSize(metrics.fileSize) : 'Unknown', 'normal'],
    ['Sample Rate:', metrics.audioFileInfo?.sampleRate ? `${(metrics.audioFileInfo.sampleRate / 1000).toFixed(1)} kHz` : 'Unknown', 'normal'],
    ['Channels:', metrics.audioFileInfo?.channels === 1 ? 'Mono' : metrics.audioFileInfo?.channels === 2 ? 'Stereo' : `${metrics.audioFileInfo?.channels || 'Unknown'}-Channel`, 'normal'],
    ['Bit Depth:', metrics.audioFileInfo?.bitDepth ? `${metrics.audioFileInfo.bitDepth} bit` : 'Unknown', 'normal'],
    ['Encoding:', metrics.audioFileInfo?.encoding || 'Unknown', 'normal'],
  ];

  drawTwoColumnData(fileData);

  // LOUDNESS ANALYSIS
  drawSectionHeader('Loudness Analysis', 'EBU R 128 / ITU-R BS.1770-4 Standard');
  
  const integratedLufs = metrics.loudnessDetailed?.integrated || metrics.loudness;
  
  const loudnessData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
    ['Integrated Loudness:', `${integratedLufs.toFixed(1)} LUFS`, 'normal'],
    ['Momentary Maximum:', metrics.loudnessDetailed ? `${metrics.loudnessDetailed.momentaryMax.toFixed(1)} LUFS` : 'Not Available', 'normal'],
    ['Short-Term Maximum:', metrics.loudnessDetailed ? `${metrics.loudnessDetailed.shortTermMax.toFixed(1)} LUFS` : 'Not Available', 'normal'],
    ['RMS Level:', `${metrics.rms.toFixed(1)} dB`, 'normal'],
  ];

  drawTwoColumnData(loudnessData);

  // Platform compliance summary
  if (metrics.technicalAnalysis?.true_peak) {
    yPosition -= 10;
    currentPage.drawText('Platform Compliance Summary:', {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: colors.primary,
    });
    yPosition -= 25;

    const platforms = [
      ['Broadcast Standard (-1.0 dBTP):', metrics.technicalAnalysis.true_peak.broadcast_compliant ? 'PASS' : 'FAIL', metrics.technicalAnalysis.true_peak.broadcast_compliant ? 'success' : 'error'],
      ['Spotify (-1.0 dBTP):', metrics.technicalAnalysis.true_peak.spotify_compliant ? 'PASS' : 'FAIL', metrics.technicalAnalysis.true_peak.spotify_compliant ? 'success' : 'error'],
      ['YouTube (-1.0 dBTP):', metrics.technicalAnalysis.true_peak.youtube_compliant ? 'PASS' : 'FAIL', metrics.technicalAnalysis.true_peak.youtube_compliant ? 'success' : 'error'],
    ] as Array<[string, string, 'normal' | 'success' | 'warning' | 'error']>;

    drawKeyValuePairs(platforms);
  }

  // TECHNICAL ANALYSIS (if available)
  if (metrics.technicalAnalysis) {
    // True Peak Analysis
    drawSectionHeader('True Peak Analysis', 'ITU-R BS.1770-4 Compliant Detection');
    
    const truePeakData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
      ['True Peak Level:', `${metrics.technicalAnalysis.true_peak.level.toFixed(1)} dBTP`, 
       metrics.technicalAnalysis.true_peak.level <= -1.0 ? 'success' : 'error'],
      ['Peak Events Detected:', `${metrics.technicalAnalysis.true_peak.locations.length}`, 
       metrics.technicalAnalysis.true_peak.locations.length <= 50 ? 'success' : 
       metrics.technicalAnalysis.true_peak.locations.length <= 200 ? 'warning' : 'error'],
      ['Headroom Available:', `${Math.max(0, -1.0 - metrics.technicalAnalysis.true_peak.level).toFixed(1)} dB`, 'normal'],
      ['Streaming Safe:', metrics.technicalAnalysis.true_peak.level <= -1.0 ? 'YES' : 'NO',
       metrics.technicalAnalysis.true_peak.level <= -1.0 ? 'success' : 'error'],
    ];

    drawTwoColumnData(truePeakData);

    // Quality Assessment
    drawSectionHeader('Quality Assessment');
    
    const qualityData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
      ['Digital Clipping:', metrics.technicalAnalysis.quality.has_clipping ? 'DETECTED' : 'CLEAN',
       metrics.technicalAnalysis.quality.has_clipping ? 'error' : 'success'],
      ['Clipped Samples:', metrics.technicalAnalysis.quality.has_clipping ? 
       `${metrics.technicalAnalysis.quality.clipped_samples} (${(metrics.technicalAnalysis.quality.clipping_percentage * 100).toFixed(3)}%)` : 'None',
       metrics.technicalAnalysis.quality.has_clipping ? 'error' : 'success'],
      ['DC Offset:', `${(Math.abs(metrics.technicalAnalysis.quality.dc_offset) * 1000).toFixed(1)} mV`,
       Math.abs(metrics.technicalAnalysis.quality.dc_offset) < 0.001 ? 'success' : 
       Math.abs(metrics.technicalAnalysis.quality.dc_offset) < 0.005 ? 'warning' : 'error'],
      ['Leading Silence:', `${metrics.technicalAnalysis.silence.leading_silence.toFixed(1)} seconds`, 'normal'],
      ['Trailing Silence:', `${metrics.technicalAnalysis.silence.trailing_silence.toFixed(1)} seconds`, 'normal'],
    ];

    drawTwoColumnData(qualityData);

    // Spectral Analysis
    drawSectionHeader('Spectral Analysis');
    
    const spectralData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
      ['Spectral Centroid:', `${(metrics.technicalAnalysis.spectral.centroid / 1000).toFixed(1)} kHz`, 'normal'],
      ['Spectral Rolloff:', `${(metrics.technicalAnalysis.spectral.rolloff / 1000).toFixed(1)} kHz`, 'normal'],
      ['Spectral Flatness:', `${(metrics.technicalAnalysis.spectral.flatness * 100).toFixed(1)}%`, 'normal'],
      // Zero crossing rate temporarily disabled
      // ['Zero Crossing Rate:', `${(metrics.technicalAnalysis.spectral.zero_crossing_rate * 1000).toFixed(0)} per ms`, 'normal'],
    ];

    drawTwoColumnData(spectralData);

    // Frequency Balance
    yPosition -= 10;
    currentPage.drawText('Frequency Balance Distribution:', {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: colors.primary,
    });
    yPosition -= 25;

    const frequencyBands = [
      ['Sub Bass (20-60 Hz):', `${metrics.technicalAnalysis.spectral.frequency_balance.sub_bass.toFixed(1)}%`, 'normal'],
      ['Bass (60-250 Hz):', `${metrics.technicalAnalysis.spectral.frequency_balance.bass.toFixed(1)}%`, 'normal'],
      ['Low Mids (250-500 Hz):', `${metrics.technicalAnalysis.spectral.frequency_balance.low_mids.toFixed(1)}%`, 'normal'],
      ['Mids (500Hz-2kHz):', `${metrics.technicalAnalysis.spectral.frequency_balance.mids.toFixed(1)}%`, 'normal'],
      ['Upper Mids (2-4 kHz):', `${metrics.technicalAnalysis.spectral.frequency_balance.upper_mids.toFixed(1)}%`, 'normal'],
      ['Presence (4-6 kHz):', `${metrics.technicalAnalysis.spectral.frequency_balance.presence.toFixed(1)}%`, 'normal'],
      ['Brilliance (6-20 kHz):', `${metrics.technicalAnalysis.spectral.frequency_balance.brilliance.toFixed(1)}%`, 'normal'],
    ] as Array<[string, string, 'normal' | 'success' | 'warning' | 'error']>;

    drawKeyValuePairs(frequencyBands);

    // Mastering Assessment
    drawSectionHeader('Mastering Assessment');
    
    const qualityScore = metrics.technicalAnalysis.mastering.quality_score;
    const masteringData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
      ['Overall Quality Score:', `${qualityScore.toFixed(0)}/100`, 
       qualityScore >= 80 ? 'success' : qualityScore >= 60 ? 'warning' : 'error'],
      ['Quality Rating:', 
       qualityScore >= 80 ? 'Professional' : qualityScore >= 60 ? 'Good' : 'Needs Work',
       qualityScore >= 80 ? 'success' : qualityScore >= 60 ? 'warning' : 'error'],
      ['PLR (Peak-to-Loudness):', `${metrics.technicalAnalysis.mastering.plr.toFixed(1)} dB`, 'normal'],
      ['Dynamic Range:', `${metrics.technicalAnalysis.mastering.dynamic_range.toFixed(1)} dB`,
       metrics.technicalAnalysis.mastering.dynamic_range >= 10 ? 'success' : 
       metrics.technicalAnalysis.mastering.dynamic_range >= 6 ? 'warning' : 'error'],
      ['Punchiness:', `${(metrics.technicalAnalysis.mastering.punchiness * 100).toFixed(0)}%`, 'normal'],
      ['Warmth:', `${(metrics.technicalAnalysis.mastering.warmth * 100).toFixed(0)}%`, 'normal'],
      ['Clarity:', `${(metrics.technicalAnalysis.mastering.clarity * 100).toFixed(0)}%`, 'normal'],
      ['Spaciousness:', `${(metrics.technicalAnalysis.mastering.spaciousness * 100).toFixed(0)}%`, 'normal'],
    ];

    drawTwoColumnData(masteringData);
  }

     // STEREO ANALYSIS (if available and not mono)
   if (metrics.stereoAnalysis && !metrics.stereoAnalysis.is_mono) {
     drawSectionHeader('Stereo Field Analysis');
     
     const stereoData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
       ...(metrics.stereoAnalysis.stereo_width !== undefined ? [
         ['Stereo Width:', `${(metrics.stereoAnalysis.stereo_width * 100).toFixed(1)}%`, 'normal'] as [string, string, 'normal' | 'success' | 'warning' | 'error']
       ] : []),
       ...(metrics.stereoAnalysis.phase_correlation !== undefined ? [
         ['Phase Correlation:', `${metrics.stereoAnalysis.phase_correlation >= 0 ? '+' : ''}${metrics.stereoAnalysis.phase_correlation.toFixed(3)}`,
          metrics.stereoAnalysis.phase_correlation >= 0.5 ? 'success' : 
          metrics.stereoAnalysis.phase_correlation >= 0.2 ? 'warning' : 'error'] as [string, string, 'normal' | 'success' | 'warning' | 'error']
       ] : []),
       ...(metrics.stereoAnalysis.lr_balance !== undefined ? [
         ['L/R Balance:', `${metrics.stereoAnalysis.lr_balance >= 0 ? '+' : ''}${metrics.stereoAnalysis.lr_balance.toFixed(1)} dB`,
          Math.abs(metrics.stereoAnalysis.lr_balance) <= 1.0 ? 'success' : 
          Math.abs(metrics.stereoAnalysis.lr_balance) <= 3.0 ? 'warning' : 'error'] as [string, string, 'normal' | 'success' | 'warning' | 'error']
       ] : []),
       ...(metrics.stereoAnalysis.mono_compatibility !== undefined ? [
         ['Mono Compatibility:', `${(metrics.stereoAnalysis.mono_compatibility * 100).toFixed(0)}%`,
          metrics.stereoAnalysis.mono_compatibility >= 0.8 ? 'success' : 
          metrics.stereoAnalysis.mono_compatibility >= 0.6 ? 'warning' : 'error'] as [string, string, 'normal' | 'success' | 'warning' | 'error']
       ] : []),
       ...(metrics.stereoAnalysis.imaging_quality ? [
         ['Imaging Quality:', metrics.stereoAnalysis.imaging_quality,
          metrics.stereoAnalysis.imaging_quality === 'Professional' ? 'success' : 
          ['High Quality', 'Good'].includes(metrics.stereoAnalysis.imaging_quality) ? 'warning' : 'error'] as [string, string, 'normal' | 'success' | 'warning' | 'error']
       ] : [])
     ];

     if (stereoData.length > 0) {
       drawTwoColumnData(stereoData);
     }
   }

  // RECOMMENDATIONS SECTION
  addNewPageIfNeeded(200);
  drawSectionHeader('Recommendations & Next Steps');

  // Generate specific recommendations based on analysis
  const recommendations: string[] = [];
  
  if (metrics.technicalAnalysis) {
    if (metrics.technicalAnalysis.true_peak.level > -1.0) {
      recommendations.push(`• CRITICAL: Reduce peak levels by ${(metrics.technicalAnalysis.true_peak.level + 1.0).toFixed(1)} dB for streaming compliance`);
    }
    
    if (metrics.technicalAnalysis.quality.has_clipping) {
      recommendations.push(`• Remove digital clipping artifacts (${metrics.technicalAnalysis.quality.clipped_samples} samples affected)`);
    }
    
    if (Math.abs(metrics.technicalAnalysis.quality.dc_offset) > 0.005) {
      recommendations.push(`• Correct DC offset issues (${(Math.abs(metrics.technicalAnalysis.quality.dc_offset) * 1000).toFixed(1)} mV detected)`);
    }
    
    if (metrics.technicalAnalysis.mastering.dynamic_range < 6) {
      recommendations.push(`• Increase dynamic range for better musicality (currently ${metrics.technicalAnalysis.mastering.dynamic_range.toFixed(1)} dB)`);
    }
    
    if (metrics.technicalAnalysis.mastering.quality_score < 60) {
      recommendations.push('• Consider professional mastering for optimal quality');
    }
  }

  if (metrics.stereoAnalysis && !metrics.stereoAnalysis.is_mono) {
    if (metrics.stereoAnalysis.phase_correlation !== undefined && metrics.stereoAnalysis.phase_correlation < 0.2) {
      recommendations.push('• Address phase correlation issues for better mono compatibility');
    }
    
    if (metrics.stereoAnalysis.lr_balance !== undefined && Math.abs(metrics.stereoAnalysis.lr_balance) > 3.0) {
      recommendations.push(`• Correct L/R balance (${metrics.stereoAnalysis.lr_balance.toFixed(1)} dB offset detected)`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('• Audio meets professional standards - ready for distribution');
    recommendations.push('• Consider A/B testing with reference tracks');
    recommendations.push('• Document analysis for future reference');
  }

  recommendations.push('• Export this report for mastering engineer review');
  recommendations.push('• Run comparative analysis with different master versions');

  // Draw recommendations
  recommendations.forEach((rec, index) => {
    addNewPageIfNeeded(20);
    const color = rec.includes('CRITICAL') ? colors.error : 
                  rec.includes('ready for distribution') ? colors.success : colors.primary;
    
    currentPage.drawText(rec, {
      x: margin,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: color,
    });
    yPosition -= 18;
  });

  // PROCESSING INFORMATION
  yPosition -= 30;
  drawSectionHeader('Processing Information');
  
  const processingData: Array<[string, string, 'normal' | 'success' | 'warning' | 'error']> = [
    ['Analysis Duration:', metrics.processingTime ? `${(metrics.processingTime / 1000).toFixed(2)} seconds` : 'Unknown', 'normal'],
    ['K-Weighting Time:', `${(metrics.performance.kWeightingTime / 1000).toFixed(2)} seconds`, 'normal'],
    ['Block Processing Time:', `${(metrics.performance.blockProcessingTime / 1000).toFixed(2)} seconds`, 'normal'],
    ['Total Processing Time:', `${(metrics.performance.totalTime / 1000).toFixed(2)} seconds`, 'normal'],
  ];

  drawTwoColumnData(processingData);

  // FOOTER ON LAST PAGE
  yPosition = 80; // Position footer at bottom
  
  currentPage.drawText('Important Notice:', {
    x: margin,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: colors.primary,
  });
  yPosition -= 20;

  const disclaimerText = [
    'This report is generated by automated analysis and is for informational purposes only.',
    'Results should be verified by professional audio engineers before making critical decisions.',
    'Lufalyze assumes no responsibility for the accuracy or completeness of this analysis.',
    'All measurements comply with EBU R 128 and ITU-R BS.1770-4 standards where applicable.'
  ];

  disclaimerText.forEach(text => {
    currentPage.drawText(text, {
      x: margin,
      y: yPosition,
      size: 8,
      font: helvetica,
      color: colors.muted,
    });
    yPosition -= 12;
  });

  yPosition -= 10;
  currentPage.drawText('Generated by Lufalyze Professional Audio Analysis Platform | lufalyze.com', {
    x: margin,
    y: yPosition,
    size: 9,
    font: helveticaBold,
    color: colors.secondary,
  });

  currentPage.drawText(reportId, {
    x: width - 120,
    y: yPosition,
    size: 8,
    font: courier,
    color: colors.muted,
  });

  // Serialize the PDF document
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
} 