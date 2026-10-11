// 作品リスト印刷工房の回帰テスト（bt = browser test）
const { test, expect } = require('@playwright/test');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FIX = p => path.resolve(__dirname, 'fixtures', p);

async function open(page){
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => typeof lastFit !== 'undefined' && lastFit);
  return errors;
}

async function loadFixture(page){
  await page.setInputFiles('#fileData', FIX('sample.xlsx'));
  await expect(page.locator('#dataInfo')).toContainText('126件');
}

test('bt01 126件（テスト用の架空データ）がA3両面1枚に収まる', async ({ page }) => {
  const errors = await open(page);
  await loadFixture(page);
  await expect(page.locator('#status')).toContainText('126件');
  await expect(page.locator('#status')).toContainText('A3両面1枚に収めました');
  const placed = await page.evaluate(() => [lastFit.placed, lastFit.total, lastFit.fs]);
  expect(placed[0]).toBe(placed[1]);
  expect(placed[2]).toBeGreaterThanOrEqual(9);
  expect(placed[2]).toBeLessThanOrEqual(12);
  expect(errors).toEqual([]);
});

test('bt02 先頭行はNo.00、番号欄は折り返さない', async ({ page }) => {
  await open(page);
  const first = await page.locator('#f0 tbody tr').first().locator('td').first().textContent();
  expect(first).toBe('00');
  const wrapped = await page.evaluate(() => [...document.querySelectorAll('.flow td.num')]
    .filter(td => getComputedStyle(td).whiteSpace !== 'nowrap').length);
  expect(wrapped).toBe(0);
});

test('bt03 「1行」列のセルはすべて改行位置以外で折り返さず、9pt未満にならない', async ({ page }) => {
  await open(page);
  await loadFixture(page);
  const r = await page.evaluate(() => {
    const bad = [], small = [];
    document.querySelectorAll('.flow tbody td').forEach(td => {
      if (td.classList.contains('num') || td.classList.contains('nw') || !td.textContent) return;
      if (!td.classList.contains('fit')) bad.push(td.textContent);
      if (parseFloat(getComputedStyle(td).fontSize) < 12 - 0.01) small.push(td.textContent); // 12px = 9pt
    });
    return { bad, small };
  });
  expect(r.bad).toEqual([]);
  expect(r.small).toEqual([]);
});

test('bt04 セル内改行の位置で改行される', async ({ page }) => {
  await open(page);
  // セル内改行は、紙面でもその位置で改行される
  const cells = await page.evaluate(() => [...document.querySelectorAll('.flow tbody td')]
    .filter(td => td.textContent.includes('\n')).map(td => [td.textContent, td.classList.contains('fit')]));
  expect(cells.length).toBeGreaterThan(3);
  for (const [, fit] of cells) expect(fit).toBe(true);
  expect(cells.map(c => c[0])).toContain('施釉瓦\n(緑釉／黄瀬戸／鉄釉)');
});

test('bt05 Excel（.xlsx）を読み込める', async ({ page }) => {
  await open(page);
  await loadFixture(page);
  await expect(page.locator('#pExName')).toHaveText('「テスト展」');
  await expect(page.locator('#status')).toContainText('A3両面1枚に収めました');
});

test('bt06 平面図の画像を追加し「幅いっぱい」で段の幅になり、リストが下に下がる', async ({ page }) => {
  await open(page);
  const y0 = (await page.locator('#pTitleBox').boundingBox()).y;
  await page.setInputFiles('#fileImg', FIX('plan.png'));
  await page.locator('.pimg').first().click();
  await page.click('#selWide');
  const w = await page.evaluate(() => S.images[0].w);
  expect(Math.round(w)).toBe(191);
  await page.waitForTimeout(300);
  const y1 = (await page.locator('#pTitleBox').boundingBox()).y;
  expect(y1).not.toBe(y0);
});

test('bt07 枠の高さを数値で変えるとリストの開始位置が動く', async ({ page }) => {
  await open(page);
  await page.fill('#planHNum', '60'); await page.press('#planHNum', 'Tab');
  const a = (await page.locator('#pTitleBox').boundingBox()).y;
  await page.fill('#planHNum', '150'); await page.press('#planHNum', 'Tab');
  const b = (await page.locator('#pTitleBox').boundingBox()).y;
  expect(b).toBeGreaterThan(a);
});

test('bt08 枠を段の幅より広げると右の段のリストが枠の下から始まる', async ({ page }) => {
  await open(page);
  await page.fill('#planWNum', '260'); await page.press('#planWNum', 'Tab');
  await page.waitForTimeout(300);
  await expect(page.locator('#planWideNote')).toBeVisible();
  const mt = await page.evaluate(() => parseFloat(document.getElementById('f1').style.marginTop) || 0);
  expect(mt).toBeGreaterThan(50);
});

test('bt09 図面にテキストを追加し、文字間・行間を変えられる', async ({ page }) => {
  await open(page);
  await page.click('#txtAdd');
  await page.keyboard.type('入口');
  await page.fill('#tLs', '0.5'); await page.dispatchEvent('#tLs', 'input');
  await page.fill('#tLh', '2'); await page.dispatchEvent('#tLh', 'input');
  const t = await page.evaluate(() => S.texts[0]);
  expect(t.text).toBe('入口'); expect(t.ls).toBe(0.5); expect(t.lh).toBe(2);
});

test('bt10 見出しを紙面で直接書き換えるとサイドバーにも反映される', async ({ page }) => {
  await open(page);
  await page.click('#pListTitle');
  await page.keyboard.press('End');
  await page.keyboard.type('（前期）');
  await page.keyboard.press('Enter');
  await expect(page.locator('#listTitle')).toHaveValue(/（前期）$/);
});

test('bt11 見出しの文字は14pt未満にできない', async ({ page }) => {
  await open(page);
  await page.fill('#fsTitle', '10'); await page.dispatchEvent('#fsTitle', 'change');
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('pListTitle')).fontSize));
  expect(px).toBeGreaterThanOrEqual(14 * 96 / 72 - 0.01);
});

test('bt12 印刷するとA3横の2ページになる', async ({ page }) => {
  await open(page);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const s = pdf.toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages).toBe(2);
  expect(s).toMatch(/MediaBox\s*\[\s*0\s+0\s+119[01]\.\d+\s+841\.\d+/);
});
