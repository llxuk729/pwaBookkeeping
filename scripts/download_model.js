import fs from 'fs';
import path from 'path';

// Let's use Xenova/bge-small-zh-v1.5 as it's a known small chinese embedding model
const modelName = 'Xenova/bge-small-zh-v1.5';
const baseUrl = `https://huggingface.co/${modelName}/resolve/main/`;
const targetDir = path.join(process.cwd(), 'public', 'models', modelName);

const filesToDownload = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.txt',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx'
];

fs.mkdirSync(path.join(targetDir, 'onnx'), { recursive: true });

async function downloadFile(file) {
  const targetPath = path.join(targetDir, file);
  if (fs.existsSync(targetPath)) {
    console.log(`✅ Already exists: ${file}`);
    return;
  }

  console.log(`⬇️ Downloading ${file}...`);
  const response = await fetch(baseUrl + file);
  
  if (!response.ok) {
    throw new Error(`Failed to download ${file}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
  console.log(`✅ Downloaded: ${file}`);
}

async function main() {
  console.log(`Starting download for ${modelName}...`);
  for (const file of filesToDownload) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`❌ Error downloading ${file}:`, err);
    }
  }
  console.log('All downloads completed!');
}

main();
