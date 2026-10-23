const { test, expect } = require('@playwright/test');

test('從字庫管理進入三種介面並返回', async ({ page }, testInfo) => {
  await page.goto('/settings.html#manage');
  await page.locator('#managePage a[data-page="organizer"]').click();
  const organizer=page.frameLocator('iframe[title="字庫分組與複合字庫"]');
  await organizer.getByRole('link',{name:'試用三種拖曳式目錄介面'}).click();
  await expect(page.locator('#currentPageTitle')).toHaveText('目錄介面試用');
  const trial=page.frameLocator('iframe[title="字庫目錄試用比較"]');
  await expect(trial.getByRole('heading',{name:'三種字庫目錄試用'})).toBeVisible();
  await page.locator('#treeTrialPage a[data-page="organizer"]').click();
  await expect(page.locator('#currentPageTitle')).toHaveText('字庫分組與複合字庫');
});

test('各介面的資料夾加號可新增子資料夾', async ({ page }) => {
  for(const engine of ['tree','sortable','wunder']) {
    await page.goto('/tree_comparison.html');
    await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1',JSON.stringify({folders:[{id:'f1',name:'中文',parent:''}],units:[]})));
    await page.reload();
    await page.locator(`[data-engine="${engine}"]`).click();
    page.once('dialog', dialog=>dialog.accept('課本'));
    await page.getByRole('button',{name:'在 中文 新增資料夾'}).click();
    const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')));
    expect(draft.folders.find(f=>f.name==='課本').parent).toBe('f1');
  }
});

test('目錄無需捲動時，滾輪可繼續捲動頁面', async ({ page }) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'f1',name:'中文',parent:''}],units:[]})));
  await page.reload();
  await page.locator('[data-engine="wunder"]').click();
  await page.evaluate(() => { document.body.style.paddingBottom='1000px'; });
  const tree=page.locator('#tree');
  await tree.scrollIntoViewIfNeeded();
  await tree.hover();
  const before=await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test('Wunderbaum 長目錄隨內容伸縮，頁面接收滾輪', async ({ page }) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'parent',name:'課本',parent:''}, ...Array.from({length:80},(_,i)=>({id:`f${i}`,name:`資料夾${i}`,parent:'parent'}))],units:[]})));
  await page.goto('/settings.html#treeTrial');
  const frame=page.frameLocator('iframe[title="字庫目錄試用比較"]');
  await frame.locator('[data-engine="wunder"]').click();
  const tree=frame.locator('#tree');
  const parent=frame.locator('.wb-row').filter({has:frame.getByRole('button',{name:'在 課本 新增資料夾'})});
  await expect(frame.getByText('📁 資料夾79',{exact:true})).toBeAttached();
  await parent.locator('.wb-expander').click();
  await expect.poll(()=>tree.evaluate(el=>el.offsetHeight)).toBeLessThan(300);
  const compact=await tree.evaluate(el=>el.offsetHeight);
  await parent.locator('.wb-expander').click();
  await expect(frame.getByText('📁 資料夾79',{exact:true})).toBeAttached();
  await expect.poll(()=>tree.evaluate(el=>el.offsetHeight)).toBeGreaterThan(compact+1000);
  await expect.poll(()=>page.locator('#treeTrialPage iframe').evaluate(el=>el.offsetHeight)).toBeGreaterThan(2000);
  await frame.getByText('📁 資料夾79',{exact:true}).scrollIntoViewIfNeeded();
  expect(await tree.evaluate(el=>el.scrollTop)).toBe(0);
  const before=await page.evaluate(()=>window.scrollY);
  await frame.getByText('📁 資料夾79',{exact:true}).hover();
  await page.mouse.wheel(0,-500);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(before);
  await parent.locator('.wb-expander').click();
  await expect.poll(()=>tree.evaluate(el=>el.offsetHeight)).toBeLessThan(compact+50);
  await expect.poll(()=>page.locator('#treeTrialPage iframe').evaluate(el=>el.offsetHeight)).toBeLessThan(2000);
});

test('三種目錄操作共用試用副本，不修改正式資料', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wordflash_units_v1', JSON.stringify({current:'甲',units:{甲:['茶'],乙:['書']}})));
  await page.goto('/tree_comparison.html');
  await expect(page.locator('#tree')).toContainText('甲');
  await expect(page.locator('#status')).toBeEmpty();
  page.once('dialog', dialog => dialog.accept('中文'));
  await page.locator('#addRoot').click();
  await expect(page.locator('#tree')).toContainText('中文');
  await page.locator('[data-engine="sortable"]').click();
  await expect(page.locator('#tree')).toContainText('中文');
  page.once('dialog', dialog => dialog.accept('甲改名'));
  await page.getByRole('button', {name:'📖 甲',exact:true}).click();
  await page.locator('#moveTarget').selectOption({label:'中文'});
  await page.locator('#moveButton').click();
  await page.locator('[data-engine="wunder"]').click();
  await expect(page.locator('#tree')).toContainText('甲改名');
  await expect(page.locator('#status')).not.toContainText('失敗');
  page.once('dialog', dialog => dialog.accept('新的中文'));
  await page.locator('.wb-title').filter({hasText:'中文'}).click();
  await expect(page.locator('#tree')).toContainText('新的中文');
  const result=await page.evaluate(()=>({real:JSON.parse(localStorage.getItem('wordflash_units_v1')), trial:JSON.parse(localStorage.getItem('wordflash_tree_trial_v1'))}));
  expect(Object.keys(result.real.units)).toEqual(['甲','乙']);
  expect(result.trial.units.find(u=>u.name==='甲改名').folder).toBe(result.trial.folders.find(f=>f.name==='新的中文').id);
});

test('Tree-element 與 SortableJS 觸控長按拖曳', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-10a', '使用觸控手機模擬');
  for (const engine of ['tree','sortable']) {
    await page.goto('/tree_comparison.html');
    await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'f1',name:'中文',parent:''}],units:[{id:'u1',name:'茶',folder:''}]})));
    await page.reload();
    await page.locator(`[data-engine="${engine}"]`).click();
    const source=engine==='tree' ? page.locator('.tree-element-title').filter({hasText:'茶'}) : page.locator('li[data-key="u:u1"] .handle');
    const target=engine==='tree' ? page.locator('.tree-element-title').filter({hasText:'中文'}) : page.locator('.sortable-list[data-folder="f1"]');
    await source.scrollIntoViewIfNeeded();
    const a=await source.boundingBox(), b=await target.boundingBox();
    const cdp=await page.context().newCDPSession(page);
    let prompts=0;
    const onDialog=dialog=>{ prompts++; return dialog.dismiss(); };
    page.on('dialog',onDialog);
    const start={x:a.x+a.width/2,y:a.y+a.height/2}, end={x:b.x+b.width/2,y:b.y+b.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    await page.waitForTimeout(400);
    for(let i=1;i<=12;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}]});
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')).units[0].folder),{message:`${engine} touch drop`}).toBe('f1');
    expect(prompts, `${engine} 拖曳後不應開啟改名`).toBe(0);
    page.off('dialog',onDialog);
    await cdp.detach();
  }
});

test('三種元件的拖曳可將字庫移到資料夾', async ({ page }) => {
  for (const engine of ['tree','sortable','wunder']) {
    await page.goto('/tree_comparison.html');
    await page.evaluate(() => {
      localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'f1',name:'中文',parent:''}],units:[{id:'u1',name:'茶',folder:''}]}));
    });
    await page.reload();
    await page.locator(`[data-engine="${engine}"]`).click();
    let source, target;
    if (engine==='tree') {
      source=page.locator('.tree-element-title').filter({hasText:'茶'});
      target=page.locator('.tree-element-title').filter({hasText:'中文'});
    } else if (engine==='sortable') {
      source=page.locator('li[data-key="u:u1"] .handle');
      target=page.locator('.sortable-list[data-folder="f1"]');
    } else {
      source=page.locator('.wb-title').filter({hasText:'茶'});
      target=page.locator('.wb-title').filter({hasText:'中文'});
    }
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();
    const a=await source.boundingBox(), b=await target.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')).units[0].folder),{message:`${engine} drop`}).toBe('f1');
  }
});
