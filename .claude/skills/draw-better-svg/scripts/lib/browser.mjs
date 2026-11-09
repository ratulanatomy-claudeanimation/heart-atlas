// Launch an installed Chromium-family browser through playwright-core, so no
// browser download is needed. Order: CHROME_BIN, Chrome, Edge, then a browser
// installed by `npx playwright install chromium`.
export async function launchBrowser(chromium) {
  if (!chromium) ({ chromium } = await import('playwright-core'));
  const attempts = [];
  if (process.env.CHROME_BIN) attempts.push({ executablePath: process.env.CHROME_BIN });
  attempts.push({ channel: 'chrome' }, { channel: 'msedge' }, {});
  const reasons = [];
  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (e) {
      reasons.push(`${JSON.stringify(options)}: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error(
    'No Chromium-family browser could be started. Install Chrome or Edge, set CHROME_BIN, ' +
    `or run \`npx playwright install chromium\`.\n${reasons.join('\n')}`,
  );
}
