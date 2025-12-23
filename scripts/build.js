#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src');
const pkg = require('../package.json');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'css/style.css'), 'utf8');
const logic = fs.readFileSync(path.join(src, 'js/clock-logic.js'), 'utf8');
const app = fs.readFileSync(path.join(src, 'js/app.js'), 'utf8');

let output = html
  // Remove dev-only external references (flexible whitespace handling)
  .replace(/\s*<link\s+rel="stylesheet"\s+href="css\/style\.css"\s*\/?>\s*\n?/gi, '')
  .replace(/\s*<script\s+src="js\/clock-logic\.js"\s*><\/script>\s*\n?/gi, '')
  .replace(/\s*<script\s+src="js\/app\.js"\s*><\/script>\s*\n?/gi, '')
  // Inject combined content
  .replace('<!-- BUILD:CSS -->', `<style>\n${css}  </style>`)
  .replace('<!-- BUILD:JS -->', `<script>\n${logic}\n${app}  </script>`)
  .replace('>dev</span>', `>${pkg.version}</span>`);

const outPath = path.join(__dirname, '../TimerPie.html');
fs.writeFileSync(outPath, output);
console.log('Built TimerPie.html (' + output.length + ' bytes)');
