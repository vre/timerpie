const { execSync } = require('child_process');
const path = require('path');

const sizes = [192, 512];
const iconsDir = path.join(__dirname, '..', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');

// Generate PNGs from SVG using ImageMagick
sizes.forEach(size => {
  const pngPath = path.join(iconsDir, `icon-${size}.png`);
  const cmd = `magick -background none -density 300 "${svgPath}" -resize ${size}x${size} "${pngPath}"`;
  try {
    execSync(cmd);
    console.log(`Generated ${pngPath}`);
  } catch (e) {
    // Fallback to old convert command
    const fallbackCmd = `convert -background none -density 300 "${svgPath}" -resize ${size}x${size} "${pngPath}"`;
    execSync(fallbackCmd);
    console.log(`Generated ${pngPath}`);
  }
});

console.log('Icons generated successfully!');
