import fs from 'fs';
import path from 'path';

// Read the built HTML file to extract asset names
const distPath = './dist';
const indexHtmlPath = path.join(distPath, 'index.html');
const swPath = path.join(distPath, 'service-worker.js');

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Extract JS and CSS asset names using regex
  const jsMatch = indexHtml.match(/\/assets\/index-([^"]+)\.js/);
  const cssMatch = indexHtml.match(/\/assets\/index-([^"]+)\.css/);
  
  if (jsMatch && cssMatch) {
    const jsFile = `/assets/index-${jsMatch[1]}.js`;
    const cssFile = `/assets/index-${cssMatch[1]}.css`;
    
    // Read the service worker file
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Update the cache name to force refresh
    const timestamp = Date.now();
    swContent = swContent.replace(
      /const CACHE_NAME = 'timeslice-cache-v\d+';/,
      `const CACHE_NAME = 'timeslice-cache-v${timestamp}';`
    );
    
    // Update the asset URLs in the service worker
    swContent = swContent.replace(
      /\/assets\/index-[^'"]+\.js/g,
      jsFile
    );
    
    swContent = swContent.replace(
      /\/assets\/index-[^'"]+\.css/g,
      cssFile
    );
    
    // Write the updated service worker
    fs.writeFileSync(swPath, swContent);
    
    console.log('✅ Service worker updated with:');
    console.log(`   JS: ${jsFile}`);
    console.log(`   CSS: ${cssFile}`);
    console.log(`   Cache: timeslice-cache-v${timestamp}`);
  } else {
    console.error('❌ Could not find asset files in index.html');
  }
} else {
  console.error('❌ dist/index.html not found. Run build first.');
}
