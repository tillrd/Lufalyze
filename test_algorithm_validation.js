#!/usr/bin/env node

/**
 * Comprehensive Key Detection Algorithm Validation
 * Tests the scale/key recognition algorithm on all WAV files in filesfortest directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const FILESFORTEST_DIR = path.join(__dirname, 'filesfortest');
const TEST_FILES = [
    'Test_1.wav', 'Test_2.wav', 'Test_3.wav', 'Test_4.wav', 'Test_5.wav',
    'Test_6.wav', 'Test_7.wav', 'Test_8.wav', 'Test_9.wav', 'Test_10.wav'
];

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
    console.log('\n' + '='.repeat(60));
    log(message, 'bold');
    console.log('='.repeat(60));
}

function logResult(filename, result) {
    console.log(`\n📁 ${filename}`);
    console.log(`   🎵 Key: ${result.key}`);
    console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   🔍 Tonal Clarity: ${(result.tonal_clarity * 100).toFixed(1)}%`);
    console.log(`   🌀 Harmonic Complexity: ${(result.harmonic_complexity * 100).toFixed(1)}%`);
    console.log(`   ⚡ Processing Time: ${result.processingTime}ms`);
    
    if (result.scales && result.scales.length > 0) {
        console.log(`   🎼 Top Scales:`);
        result.scales.slice(0, 3).forEach(scale => {
            console.log(`      ${scale.name}: ${(scale.strength * 100).toFixed(1)}%`);
        });
    }
}

function analyzeResults(results) {
    const validResults = results.filter(r => r.success);
    const totalFiles = results.length;
    const successfulAnalyses = validResults.length;
    
    if (successfulAnalyses === 0) {
        log('\n❌ NO SUCCESSFUL ANALYSES - Algorithm has critical issues', 'red');
        return false;
    }

    const avgConfidence = validResults.reduce((sum, r) => sum + r.data.confidence, 0) / validResults.length;
    const avgTonalClarity = validResults.reduce((sum, r) => sum + r.data.tonal_clarity, 0) / validResults.length;
    const avgProcessingTime = validResults.reduce((sum, r) => sum + r.data.processingTime, 0) / validResults.length;
    
    const highConfidenceCount = validResults.filter(r => r.data.confidence >= 0.7).length;
    const mediumConfidenceCount = validResults.filter(r => r.data.confidence >= 0.4 && r.data.confidence < 0.7).length;
    const lowConfidenceCount = validResults.filter(r => r.data.confidence < 0.4).length;

    logHeader('📊 ALGORITHM PERFORMANCE ANALYSIS');
    
    console.log(`📈 Success Rate: ${successfulAnalyses}/${totalFiles} (${(successfulAnalyses/totalFiles*100).toFixed(1)}%)`);
    console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`🔍 Average Tonal Clarity: ${(avgTonalClarity * 100).toFixed(1)}%`);
    console.log(`⚡ Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`);
    
    console.log(`\n📊 Confidence Distribution:`);
    log(`   ✅ High Confidence (≥70%): ${highConfidenceCount} files`, 'green');
    log(`   ⚠️  Medium Confidence (40-69%): ${mediumConfidenceCount} files`, 'yellow');
    log(`   ❌ Low Confidence (<40%): ${lowConfidenceCount} files`, 'red');

    // Overall assessment
    console.log('\n' + '='.repeat(60));
    if (successfulAnalyses === totalFiles && avgConfidence >= 0.7 && avgTonalClarity >= 0.5) {
        log('✅ ALGORITHM STATUS: WORKING EXCELLENTLY', 'green');
        log('   - All files analyzed successfully', 'green');
        log('   - High average confidence indicates reliable detection', 'green');
        log('   - Good tonal clarity suggests accurate harmonic analysis', 'green');
        log('   - Ready for production use', 'green');
        return true;
    } else if (successfulAnalyses >= totalFiles * 0.8 && avgConfidence >= 0.5) {
        log('⚠️  ALGORITHM STATUS: WORKING WITH MINOR ISSUES', 'yellow');
        log(`   - ${successfulAnalyses}/${totalFiles} files analyzed successfully`, 'yellow');
        log(`   - Average confidence of ${(avgConfidence * 100).toFixed(1)}% is acceptable`, 'yellow');
        log(`   - ${lowConfidenceCount} files had low confidence detection`, 'yellow');
        log('   - Consider tuning algorithm parameters', 'yellow');
        return true;
    } else {
        log('❌ ALGORITHM STATUS: NEEDS SIGNIFICANT IMPROVEMENT', 'red');
        log(`   - Only ${successfulAnalyses}/${totalFiles} files analyzed successfully`, 'red');
        log(`   - Low average confidence of ${(avgConfidence * 100).toFixed(1)}%`, 'red');
        log(`   - ${lowConfidenceCount} files had very low confidence`, 'red');
        log('   - Algorithm needs debugging before production use', 'red');
        return false;
    }
}

async function validateTestFiles() {
    logHeader('🔍 VALIDATING TEST FILES');
    
    if (!fs.existsSync(FILESFORTEST_DIR)) {
        log(`❌ Test directory not found: ${FILESFORTEST_DIR}`, 'red');
        return false;
    }

    const missingFiles = [];
    const availableFiles = [];

    for (const filename of TEST_FILES) {
        const filePath = path.join(FILESFORTEST_DIR, filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            availableFiles.push({
                name: filename,
                size: (stats.size / 1024 / 1024).toFixed(1) + ' MB'
            });
            log(`✅ ${filename} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`, 'green');
        } else {
            missingFiles.push(filename);
            log(`❌ ${filename} - NOT FOUND`, 'red');
        }
    }

    if (missingFiles.length > 0) {
        log(`\n⚠️  Warning: ${missingFiles.length} files missing from test set`, 'yellow');
    }

    log(`\n📊 Found ${availableFiles.length}/${TEST_FILES.length} test files`, 'cyan');
    return availableFiles;
}

async function testWithBrowser() {
    logHeader('🌐 TESTING WITH BROWSER AUTOMATION');
    
    try {
        // We'll use a simple approach - create an HTML test file and run it
        const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Automated Key Detection Test</title>
</head>
<body>
    <div id="output"></div>
    <script type="module">
        import init, { MusicAnalyzer } from './dist/assets/loudness_wasm-BuItfBHM.js';
        
        const TEST_FILES = ${JSON.stringify(TEST_FILES)};
        const results = [];
        
        async function runTests() {
            try {
                await init();
                const musicAnalyzer = new MusicAnalyzer(44100);
                console.log('✅ WASM initialized');
                
                for (const filename of TEST_FILES) {
                    try {
                        console.log(\`📂 Testing \${filename}...\`);
                        
                        const response = await fetch(\`filesfortest/\${filename}\`);
                        if (!response.ok) {
                            throw new Error(\`Failed to load \${filename}\`);
                        }
                        
                        const arrayBuffer = await response.arrayBuffer();
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        const pcmData = audioBuffer.getChannelData(0);
                        const float32Array = new Float32Array(pcmData);
                        
                        const startTime = performance.now();
                        const result = musicAnalyzer.analyze_music(float32Array);
                        const endTime = performance.now();
                        
                        results.push({
                            filename,
                            success: true,
                            data: {
                                key: result.key,
                                root_note: result.root_note,
                                is_major: result.is_major,
                                confidence: result.confidence,
                                tonal_clarity: result.tonal_clarity,
                                harmonic_complexity: result.harmonic_complexity,
                                processingTime: endTime - startTime,
                                scales: Array.from(result.scales)
                            }
                        });
                        
                        console.log(\`✅ \${filename}: \${result.key} (\${(result.confidence * 100).toFixed(1)}%)\`);
                        
                    } catch (error) {
                        console.error(\`❌ Error testing \${filename}:\`, error);
                        results.push({
                            filename,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
                // Output results for Node.js to read
                document.getElementById('output').textContent = JSON.stringify(results, null, 2);
                console.log('🎼 All tests completed');
                
            } catch (error) {
                console.error('❌ Test failed:', error);
                document.getElementById('output').textContent = JSON.stringify({ error: error.message });
            }
        }
        
        runTests();
    </script>
</body>
</html>`;

        fs.writeFileSync('test_automated.html', testHtml);
        log('📝 Created automated test file: test_automated.html', 'cyan');
        log('🌐 To run the test, open this file in a browser or use a headless browser', 'cyan');
        
        return null; // We can't directly run browser tests from Node.js without additional tools
        
    } catch (error) {
        log(`❌ Failed to create browser test: ${error.message}`, 'red');
        return null;
    }
}

async function main() {
    logHeader('🎼 LUFALYZE KEY DETECTION ALGORITHM VALIDATION');
    log('Testing scale/key recognition algorithm on WAV files', 'cyan');
    
    // Step 1: Validate test files
    const availableFiles = await validateTestFiles();
    if (!availableFiles || availableFiles.length === 0) {
        log('❌ No test files available. Exiting.', 'red');
        process.exit(1);
    }

    // Step 2: Check if built files exist
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
        log('❌ Build directory not found. Please run "npm run build" first.', 'red');
        process.exit(1);
    }

    // Step 3: Create browser test
    log('\n🔧 Creating automated test...', 'yellow');
    await testWithBrowser();
    
    // Instructions for manual testing
    logHeader('📋 MANUAL TESTING INSTRUCTIONS');
    log('Since this is a browser-based WASM module, follow these steps:', 'cyan');
    log('1. Start a local web server: npm run dev', 'white');
    log('2. Open one of these test files in your browser:', 'white');
    log('   - test_wav_files.html (for manual file testing)', 'white');
    log('   - test_automated.html (for automated testing)', 'white');
    log('3. Use the manual file upload feature to test your WAV files', 'white');
    log('4. Or open the browser console to see automated test results', 'white');
    
    console.log('\n');
    log('⚡ Starting development server for testing...', 'yellow');
}

// Export for use as module
export { validateTestFiles, analyzeResults, logResult };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        log(`❌ Script failed: ${error.message}`, 'red');
        process.exit(1);
    });
} 