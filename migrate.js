import fs from 'fs';
import path from 'path';

function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'src') {
        getHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const rootDir = process.cwd();
const htmlFiles = getHtmlFiles(rootDir);

htmlFiles.forEach(filepath => {
  let content = fs.readFileSync(filepath, 'utf8');
  let originalContent = content;

  let relPath = path.relative(rootDir, filepath);
  let dirName = path.dirname(relPath);
  let baseName = path.basename(relPath, '.html');
  
  // Format dirName for URLs (replace backslashes)
  let dirUrl = dirName === '.' ? '' : dirName.replace(/\\/g, '/') + '/';

  // 1. Replace Tailwind CDN
  if (content.includes('<script src="https://cdn.tailwindcss.com"></script>')) {
    content = content.replace(
      '<script src="https://cdn.tailwindcss.com"></script>',
      '<link rel="stylesheet" href="/src/main.css">'
    );
  } else if (!content.includes('/src/main.css') && content.includes('</head>')) {
    // If CDN wasn't there, still inject main.css before </head>
    content = content.replace('</head>', '    <link rel="stylesheet" href="/src/main.css">\n</head>');
  }

  // 2. Extract <style>
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatches = [];
  let match;
  while ((match = styleRegex.exec(content)) !== null) {
    styleMatches.push({
      fullMatch: match[0],
      innerContent: match[1]
    });
  }

  if (styleMatches.length > 0) {
    let combinedStyles = styleMatches.map(m => m.innerContent.trim()).join('\n\n');
    if (combinedStyles) {
      let cssDir = path.join(rootDir, 'src', 'css', dirName);
      fs.mkdirSync(cssDir, { recursive: true });
      let cssFilePath = path.join(cssDir, `${baseName}.css`);
      fs.writeFileSync(cssFilePath, combinedStyles);

      // Replace first style tag with link
      let cssUrl = `/src/css/${dirUrl}${baseName}.css`;
      content = content.replace(styleMatches[0].fullMatch, `<link rel="stylesheet" href="${cssUrl}">`);
      
      // Remove subsequent style tags
      for (let i = 1; i < styleMatches.length; i++) {
        content = content.replace(styleMatches[i].fullMatch, '');
      }
    }
  }

  // 3. Extract inline <script>
  // Match scripts without src attribute
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatches = [];
  while ((match = scriptRegex.exec(content)) !== null) {
    let inner = match[1].trim();
    if (inner.length > 0) {
      scriptMatches.push({
        fullMatch: match[0],
        innerContent: inner
      });
    }
  }

  if (scriptMatches.length > 0) {
    let combinedScripts = scriptMatches.map(m => m.innerContent).join('\n\n');
    let jsDir = path.join(rootDir, 'src', 'js', dirName);
    fs.mkdirSync(jsDir, { recursive: true });
    let jsFilePath = path.join(jsDir, `${baseName}.js`);
    fs.writeFileSync(jsFilePath, combinedScripts);

    // Replace first script tag with module link
    let jsUrl = `/src/js/${dirUrl}${baseName}.js`;
    content = content.replace(scriptMatches[0].fullMatch, `<script type="module" src="${jsUrl}"></script>`);
    
    // Remove subsequent script tags
    for (let i = 1; i < scriptMatches.length; i++) {
      content = content.replace(scriptMatches[i].fullMatch, '');
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filepath, content);
  }
});

console.log('Migration completed for all HTML files!');
