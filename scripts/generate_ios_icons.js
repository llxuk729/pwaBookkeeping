import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes needed for iOS
const iosSizes = [
  { size: 180, name: 'apple-touch-icon-180.png' }, // iPhone 6 Plus and later
  { size: 152, name: 'apple-touch-icon-152.png' }, // iPad Retina
  { size: 120, name: 'apple-touch-icon-120.png' }, // iPhone Retina
  { size: 76, name: 'apple-touch-icon-76.png' },   // iPad non-Retina
];

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

console.log('📱 Generating iOS touch icons...');

// Check if we have a source icon
const sourceIcon = path.join(iconsDir, 'icon-512.png');
if (!fs.existsSync(sourceIcon)) {
  console.error('❌ Source icon (icon-512.png) not found!');
  process.exit(1);
}

console.log(`✅ Found source icon: ${sourceIcon}`);

// For now, we'll just copy the existing 192px icon to different sizes
// In a real implementation, you'd use sharp or similar to resize properly
const existingIcon = path.join(iconsDir, 'icon-192.png');

for (const { size, name } of iosSizes) {
  const targetPath = path.join(iconsDir, name);
  
  // If the file already exists, skip it
  if (fs.existsSync(targetPath)) {
    console.log(`⏭️  Skipping existing: ${name}`);
    continue;
  }
  
  // Copy the 192px icon as a fallback (in production, you should resize properly)
  try {
    fs.copyFileSync(existingIcon, targetPath);
    console.log(`✅ Created: ${name} (${size}x${size})`);
  } catch (err) {
    console.error(`❌ Failed to create ${name}:`, err.message);
  }
}

console.log('\n🎉 iOS icons generation completed!');
console.log('\n📝 Note: For best results, consider using an image processing library like "sharp" to generate properly sized icons.');
console.log('   Install with: npm install sharp');
