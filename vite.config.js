import { defineConfig } from 'vite';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to recursively find all HTML files in a directory
function getHtmlEntries(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    // Skip node_modules and dist directories
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getHtmlEntries(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const rootDir = resolve(__dirname);
const htmlFiles = getHtmlEntries(rootDir);

// Create an input object for Rollup
const input = {};
htmlFiles.forEach((file) => {
  // Use relative path from root as the key
  let relativePath = file.replace(rootDir, '');
  if (relativePath.startsWith('\\') || relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }
  const key = relativePath.replace(/\\/g, '/').replace('.html', '');
  input[key] = file;
});

export default defineConfig({
  build: {
    rollupOptions: {
      input,
    },
  },
});
