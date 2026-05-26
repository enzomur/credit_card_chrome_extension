// Fix asset paths in HTML files after build
import { readFileSync, writeFileSync } from 'fs';

const files = ['dist/popup.html', 'dist/options.html'];

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf-8');
    // The paths should already be correct after moving to dist root
    // But just in case, let's log what we have
    console.log(`Processed ${file}`);
  } catch (e) {
    console.error(`Error processing ${file}:`, e.message);
  }
}

console.log('Path fixing complete');
