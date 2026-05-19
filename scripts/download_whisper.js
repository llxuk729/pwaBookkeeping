import fs from 'fs';
import path from 'path';

// Whisper-tiny model for local speech recognition
const modelName = 'Xenova/whisper-tiny';
const baseUrl = `https://huggingface.co/${modelName}/resolve/main/`;
const targetDir = path.join(process.cwd(), 'public', 'models', modelName);

// Files needed for whisper-tiny
// Note: whisper-tiny uses encoder-decoder architecture, not a single model file
const filesToDownload = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'preprocessor_config.json',
  'special_tokens_map.json',
  'generation_config.json',
  // Use encoder-decoder format (the quantized versions)
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx'
];

fs.mkdirSync(path.join(targetDir, 'onnx'), { recursive: true });

async function downloadFile(file, retries = 3) {
  const targetPath = path.join(targetDir, file);
  
  if (fs.existsSync(targetPath)) {
    const stats = fs.statSync(targetPath);
    if (stats.size > 0) {
      console.log(`✅ Already exists: ${file} (${formatBytes(stats.size)})`);
      return true;
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`⬇️ Downloading ${file}... (attempt ${attempt}/${retries})`);
    
    try {
      const response = await fetch(baseUrl + file);
      
      if (!response.ok) {
        throw new Error(`Failed: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
      console.log(`✅ Downloaded: ${file} (${formatBytes(arrayBuffer.byteLength)})`);
      return true;
    } catch (err) {
      console.error(`❌ Error (attempt ${attempt}): ${err.message}`);
      if (attempt < retries) {
        console.log('   Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  return false;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function main() {
  console.log('========================================');
  console.log(`Downloading ${modelName} for local deployment`);
  console.log('========================================');
  console.log(`Target: ${targetDir}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  // Try single quantized model first (smaller, simpler)
  for (const file of filesToDownload) {
    const success = await downloadFile(file);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log(`Download completed: ${successCount} success, ${failCount} failed`);
  console.log('========================================');
  
  // Calculate total size
  let totalSize = 0;
  for (const file of filesToDownload) {
    const targetPath = path.join(targetDir, file);
    if (fs.existsSync(targetPath)) {
      totalSize += fs.statSync(targetPath).size;
    }
  }
  console.log(`Total model size: ${formatBytes(totalSize)}`);
  
  if (failCount > 0) {
    console.log('');
    console.log('⚠️  Some files failed to download. Please check your network connection.');
    console.log('   You may need to use a VPN or proxy to access HuggingFace.');
  }
}

main();