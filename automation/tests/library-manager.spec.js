import { test, expect } from '@playwright/test';

test('字庫管理中心整合字庫、複合字庫與統計入口', async ({ page }, testInfo) => {
  await page.goto('/library_manager.html');
  await page.evaluate(() => {
    localStorage.setItem('wordflash_units_v1', JSON.stringify({ current: '情書', units: { 情書: ['重新|ㄔㄨㄥˊ ㄒㄧㄣ'], 英文: ['for'] } }));
    localStorage.setItem('wordflash_library_organizer_v1', JSON.stringify({
      folders: [{ id: 'zh', name: '中文', parent: '' }],
      assignments: { 情書: 'zh' },
      presets: [{ id: 'review', name: '本週複習', units: ['情書', '英文'], folder: 'zh' }]
    }));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '＋ 新增字庫' })).toBeVisible();
  await expect(page.getByText('📖 情書', { exact: true })).toBeVisible();
  await expect(page.getByText('🔗 本週複習', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-library-manager-tree.png`, fullPage: true });

  await page.getByRole('button', { name: '📖 情書' }).click();
  await expect(page.getByRole('button', { name: '編輯字庫' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看單字正確率' })).toBeVisible();
  await page.getByRole('button', { name: '查看單字正確率' }).click();
  const statsFrame = page.frameLocator('iframe[title="情書 的單字正確率"]');
  await expect(statsFrame.getByRole('heading', { name: '單字清單與正確率' })).toBeVisible();

  await page.getByRole('button', { name: '🔗 本週複習' }).click();
  await expect(page.getByRole('button', { name: '編輯組成' })).toBeVisible();
});

test('設定頁的字庫只保留整合後的管理入口', async ({ page }) => {
  await page.goto('/settings.html#manage');
  const menu = page.getByRole('button', { name: '目錄 ☰' });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('link', { name: '字庫管理', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '新增字庫', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '單字統計與設定', exact: true })).toHaveCount(0);
  const frame = page.frameLocator('iframe[title="字庫管理"]');
  await expect(frame.getByRole('heading', { name: '字庫管理' })).toBeVisible();
});

test('從樹狀目錄開啟字庫時，內嵌內容會遵守指定的字庫', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wordflash_units_v1', JSON.stringify({
      current: '片假名字庫',
      units: { 高頻詞: ['find', 'look'], 片假名字庫: ['ア', 'イ'] }
    }));
  });
  await page.goto('/library_manager.html');
  await page.getByRole('button', { name: '📖 高頻詞' }).click();
  await page.getByRole('button', { name: '查看單字正確率' }).click();
  const frame = page.frameLocator('iframe[title="高頻詞 的單字正確率"]');
  await expect(frame.getByText('find', { exact: true })).toBeVisible();
  await expect(frame.getByText('ア', { exact: true })).toHaveCount(0);
});

test('課次名稱以自然順序顯示', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wordflash_units_v1', JSON.stringify({
      current: '高頻 L10',
      units: { '高頻 L10': ['ten'], '高頻 L2': ['two'], '高頻 L1': ['one'] }
    }));
    localStorage.setItem('wordflash_library_organizer_v1', JSON.stringify({
      folders: [{ id: 'frequency', name: '高頻詞', parent: '' }],
      assignments: { '高頻 L10': 'frequency', '高頻 L2': 'frequency', '高頻 L1': 'frequency' },
      presets: []
    }));
  });
  await page.goto('/library_manager.html');
  const treeText = await page.getByRole('region', { name: '字庫分類' }).innerText();
  expect(treeText.indexOf('高頻 L1')).toBeLessThan(treeText.indexOf('高頻 L2'));
  expect(treeText.indexOf('高頻 L2')).toBeLessThan(treeText.indexOf('高頻 L10'));
});
