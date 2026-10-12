import fs from "fs";
import { chromium } from "playwright";

const satelinkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <text x="16" y="24" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="middle">S</text>
</svg>
`;

const jakuraaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none">
  <text x="16" y="24" font-family="Source Serif 4, Georgia, serif" font-size="24" font-weight="600" fill="#FFFFFF" text-anchor="middle">J</text>
</svg>
`;

// Write SVG files
fs.writeFileSync("apps/web/public/favicon.svg", satelinkSvg);
fs.writeFileSync("apps/web/src/app/icon.svg", satelinkSvg);
fs.writeFileSync("apps/corporate/public/favicon.svg", jakuraaSvg);
fs.writeFileSync("apps/corporate/app/icon.svg", jakuraaSvg);

console.log("SVGs written. Launching browser to generate transparent PNGs...");

const browser = await chromium.launch({ headless: true });

// Render Satelink PNGs
const satelinkPage = await browser.newPage();
await satelinkPage.setContent(`
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    svg { width: 100%; height: 100%; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 700; }
  </style>
  ${satelinkSvg}
`);

for (const size of [16, 32, 48, 180]) {
  await satelinkPage.setViewportSize({ width: size, height: size });
  const filename = size === 180 ? "apple-icon.png" : `favicon-${size}x${size}.png`;
  await satelinkPage.locator("svg").screenshot({
    path: `apps/web/public/${filename}`,
    omitBackground: true
  });
}

// Render Jakuraa PNGs
const jakuraaPage = await browser.newPage();
await jakuraaPage.setContent(`
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600&display=swap");
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    svg { width: 100%; height: 100%; }
    text { font-family: "Source Serif 4", Georgia, serif; font-weight: 600; }
  </style>
  ${jakuraaSvg}
`);
await jakuraaPage.waitForTimeout(500);

for (const size of [16, 32, 48, 180]) {
  await jakuraaPage.setViewportSize({ width: size, height: size });
  const filename = size === 180 ? "apple-touch-icon.png" : `favicon-${size}x${size}.png`;
  await jakuraaPage.locator("svg").screenshot({
    path: `apps/corporate/public/${filename}`,
    omitBackground: true
  });
}

await browser.close();
console.log("All white favicons generated successfully!");
