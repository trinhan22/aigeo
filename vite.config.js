import { defineConfig } from 'vite';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getHtmlEntries(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'src') {
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

const input = {};
htmlFiles.forEach((file) => {
  let relativePath = file.replace(rootDir, '');
  if (relativePath.startsWith('\\') || relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }
  const key = relativePath.replace(/\\/g, '/').replace('.html', '');
  input[key] = file;
});

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input,
    },
  },
});
