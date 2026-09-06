import { chromium } from 'playwright-core';
import { writeFile, readFile } from 'node:fs/promises';
const software = process.argv.includes('--software');
const channel = process.argv.includes('--chrome') ? 'chrome' : undefined;
const label = channel ?? (software ? 'software' : 'default');
const browser = await chromium.launch({
  headless: true,
  channel,
  args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
if (process.argv.includes('--recompile')) {
  const source = JSON.parse(await readFile('artifacts/blender-hotel/render-default.json', 'utf8'));
  const results = await page.evaluate((failures) => {
    const gl = document.createElement('canvas').getContext('webgl2');
    return failures.map((f) => {
      const program = gl.createProgram();
      const shaders = f.shaders.map((s, i) => {
        const shader = gl.createShader(i === 0 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
        gl.shaderSource(shader, s.source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
        return { status: gl.getShaderParameter(shader, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(shader) };
      });
      gl.linkProgram(program);
      return {
        shaders,
        linked: gl.getProgramParameter(program, gl.LINK_STATUS),
        log: gl.getProgramInfoLog(program),
      };
    });
  }, source.failures);
  await writeFile('artifacts/blender-hotel/shader-recompile.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
  await browser.close();
  process.exit(0);
}
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.addInitScript(() => {
  window.shaderFailures = [];
  const p = WebGL2RenderingContext.prototype,
    original = p.getProgramParameter;
  p.getProgramParameter = function (program, name) {
    const value = original.call(this, program, name);
    if (name === this.LINK_STATUS && value === false) {
      const ext = this.getExtension('WEBGL_debug_renderer_info');
      window.shaderFailures.push({
        renderer: ext ? this.getParameter(ext.UNMASKED_RENDERER_WEBGL) : this.getParameter(this.RENDERER),
        log: this.getProgramInfoLog(program),
        shaders: (this.getAttachedShaders(program) ?? []).map((s) => ({
          status: this.getShaderParameter(s, this.COMPILE_STATUS),
          log: this.getShaderInfoLog(s),
          source: this.getShaderSource(s),
        })),
      });
    }
    return value;
  };
});
try {
  await page.goto('http://127.0.0.1:5188/');
  await page.getByRole('button', { name: /Step through the rift/ }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.bk-world')?.dataset.npcReady === '7' && !document.querySelector('.bk-loading'),
    null,
    { timeout: 180000 },
  );
  await page.getByRole('button', { name: 'Open town map ↗', exact: true }).click();
  await page.locator('.city-map button[data-area="sukhumvit"]').click();
  await page.locator('.city-contacts button[data-area="station"]').click();
  await page.locator('.rpg-dialogue').waitFor({ timeout: 180000 });
  await page.screenshot({ path: `artifacts/blender-hotel/render-${label}.png` });
  const detail = await page.evaluate(() => {
    const gl = document.querySelector('.bk-world canvas').getContext('webgl2'),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      failures: window.shaderFailures,
    };
  });
  await writeFile(
    `artifacts/blender-hotel/render-${label}.json`,
    JSON.stringify({ errors, ...detail }, null, 2),
  );
  console.log(JSON.stringify({ errors, renderer: detail.renderer, failures: detail.failures.length }));
} finally {
  await browser.close();
}
