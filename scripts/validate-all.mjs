import { readFileSync } from 'fs';

const files = ['index.html', 'journey.html', 'stations.html', 'operators.html', 'about.html'];

for (const file of files) {
  const h = readFileSync('../' + file, 'utf8');
  const lines = h.split('\n').length;
  const badChars = (h.match(/\uFFFD/g) || []).length;
  const hasNav = h.includes('nav.js');

  // Find inline script
  const scriptMatch = h.match(/<script>([\s\S]*?)<\/script>/);
  let jsStatus = 'no inline script';
  if (scriptMatch) {
    try {
      new Function(scriptMatch[1]);
      jsStatus = 'OK';
    } catch (e) {
      jsStatus = 'ERROR: ' + e.message.substring(0, 100);
    }
  }

  console.log(`${file}: ${lines} lines, ${badChars} bad chars, nav=${hasNav}, JS=${jsStatus}`);
}
