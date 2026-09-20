// One-time extraction of the reference design; no HTML/scripts are executed.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
// The generated stylesheet has native React refinements; never overwrite it.
const cssPath = path.join(root, 'app/worker/page.module.css');
if (fs.existsSync(cssPath)) {
  throw new Error('The worker stylesheet already exists. Preserve its native refinements; run extraction in a fresh checkout instead.');
}
const html = fs.readFileSync(path.join(root, 'public/worker-profile.html'), 'utf8');
const css = postcss.parse(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
css.walkRules(rule => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(selector => {
    if (selector === 'html' || selector === 'body') return '.page';
    return '.page ' + selector.replace(/(^|[\s>+~])(?:html|body)(?=$|[\s>+~.#:[\]])/g, '$1.page');
  });
});
fs.writeFileSync(path.join(root, 'app/worker/page.module.css'), '/* Reference design scoped to the native React worker page. */\n' + css.toString() + '\n');
const select = html.match(/<select[^>]*id="jobDescriptionSelect"[^>]*>([\s\S]*?)<\/select>/)[1];
const options = [...select.matchAll(/<option value="([^"]+)"[^>]*>(.*?)<\/option>/g)].map(([, value, label]) => ({ value, label }));
fs.writeFileSync(path.join(root, 'app/worker/professions.ts'), '// Preserved from the original worker profile.\nexport const professions = ' + JSON.stringify(options, null, 2) + ' as const;\n');
console.log('Extracted', options.length, 'professions and parsed reference CSS.');
console.log('ID selectors:', [...new Set([...css.toString().matchAll(/#[a-zA-Z][\w-]*(?=[\s.:\[{])/g)].map(x => x[0]))]);
