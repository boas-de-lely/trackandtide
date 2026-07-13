// Re-apply all changes to HTML files after git restore
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = '\\\\LELYNAS\\trackandtide';
const FILES = ['404.html','about.html','index.html','journey.html','operators.html','ports.html','stations.html'];

for (const file of FILES) {
  const path = join(ROOT, file);
  let c = readFileSync(path, 'utf-8');

  // ── 1. Remove modal CSS blocks ──
  // Pattern A: single-line style (about.html, 404.html, journey.html)
  c = c.replace(/\n\s*\.modal-overlay\s*\{[^}]*\}\s*\n\s*\.modal-overlay\.open\s*\{[^}]*\}\s*\n[\s\S]*?\.form-success\.show\s*\{[^}]*\}\s*\n/g, '\n');
  // Pattern B: expanded multi-line style with comment header (operators, stations, ports, index)
  c = c.replace(/\n\s*\/\*\s*[-─]*\s*Modal\s*[-─]*\s*\*\/[\s\S]*?\.report-form select option\s*\{[^}]*\}\s*\n/g, '\n');
  // Also catch the simpler "/* Modal */" variant
  c = c.replace(/\n\s*\/\*\s*Modal\s*\*\/[\s\S]*?\.report-form select option\s*\{[^}]*\}\s*\n/g, '\n');
  // Clean up leftover modal CSS
  c = c.replace(/\n\s*\.form-error\s*\{[^}]*\}\s*\n/g, '\n');
  c = c.replace(/\n\s*\.report-hint\s*\{[\s\S]*?\}\s*\n/g, '\n');
  c = c.replace(/\n\s*\.form-success\s*\.success-icon\s*\{[^}]*\}\s*\n/g, '\n');

  // ── 2. Remove report modal HTML + open/close functions + submit handler ──
  // Remove the modal overlay div (from <div class="modal-overlay" id="reportModal" to the matching close)
  c = c.replace(/<div class="modal-overlay" id="reportModal"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');
  // Remove openReportModal/closeReportModal + form submit handler script blocks
  c = c.replace(/<script>\s*\n\s*function openReportModal[\s\S]*?reportForm\.addEventListener[\s\S]*?<\/script>/g, '');
  // Handle two separate script blocks (about.html, 404.html, journey.html)
  c = c.replace(/<script>\s*\n\s*function openReportModal[\s\S]*?closeReportModal[^}]*}\s*\n<\/script>/g, '');
  c = c.replace(/<script>\s*\n\s*document\.getElementById\('reportForm'\)[\s\S]*?}\);?\s*\n<\/script>/g, '');
  // Remove inline bug hint script
  c = c.replace(/<script>\s*\n\s*document\.getElementById\('reportType'\)[\s\S]*?<\/script>/g, '');

  // ── 3. Add report-modal.js before </body> ──
  c = c.replace('</body>', '<script src="report-modal.js?v=2"></script>\n</body>');

  // ── 4. Clean up double line breaks ──
  c = c.replace(/\n\n\n+/g, '\n\n');

  writeFileSync(path, c, 'utf-8');
  console.log('✓', file);
}

console.log('\nAll files processed.');
