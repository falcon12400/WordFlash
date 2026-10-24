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
