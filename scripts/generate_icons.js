import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.log('⚠️  sharp library not found. Installing...');
  console.log('Please run: npm install sharp');
  process.exit(1);
}

// Icon sizes needed for iOS and Android
const iconSizes = [
  // iOS specific
  { size: 180, name: 'apple-touch-icon-180.png', platform: 'iOS' },
  { size: 152, name: 'apple-touch-icon-152.png', platform: 'iOS' },
  { size: 120, name: 'apple-touch-icon-120.png', platform: 'iOS' },
  { size: 76, name: 'apple-touch-icon-76.png', platform: 'iOS' },
  
  // Android/Web PWA
  { size: 192, name: 'icon-192.png', platform: 'Android/Web' },
  { size: 512, name: 'icon-512.png', platform: 'Android/Web' },
];

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

console.log('🎨 Generating PWA icons with proper resizing...\n');

// Check if we have a source icon (use the largest one as source)
const sourceIcon = path.join(iconsDir, 'icon-512.png');
if (!fs.existsSync(sourceIcon)) {
  console.error('❌ Source icon (icon-512.png) not found!');
  process.exit(1);
}

console.log(`✅ Found source icon: ${sourceIcon}`);
console.log(`📐 Source size: 512x512\n`);

async function generateIcon(size, name) {
  const targetPath = path.join(iconsDir, name);
  
  try {
    await sharp(sourceIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(targetPath);
    
    console.log(`✅ Generated: ${name.padEnd(30)} (${size}x${size})`);
  } catch (err) {
    console.error(`❌ Failed to generate ${name}:`, err.message);
  }
}

// Generate all icons
for (const { size, name } of iconSizes) {
  await generateIcon(size, name);
}

console.log('\n🎉 All icons generated successfully!');
console.log('\n📱 Icons are ready for:');
console.log('   • iOS Home Screen (Apple Touch Icons)');
console.log('   • Android Home Screen');
console.log('   • Web PWA Manifest');
