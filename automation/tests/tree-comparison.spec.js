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

test('第三種目錄可在選取項目同層就地新增資料夾', async ({ page }, testInfo) => {
  for(const engine of ['tree','sortable','wunder']) {
    if(engine!=='wunder') continue;
    await page.goto('/tree_comparison.html');
    await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1',JSON.stringify({folders:[{id:'f1',name:'中文',parent:''}],units:[]})));
    await page.reload();
    await page.locator(`[data-engine="${engine}"]`).click();
    if(engine==='wunder') await page.locator('.wb-title').filter({hasText:'中文'}).click();
    await page.getByRole('button',{name:'新增資料夾'}).click();
    const input=page.getByRole('textbox',{name:'新資料夾名稱'});
    await page.screenshot({path:`artifacts/${testInfo.project.name}-wunderbaum-inline-add.png`,fullPage:true});
    await input.fill('課本');
    await page.getByRole('button',{name:'新增',exact:true}).click();
    const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')));
    expect(draft.folders.find(f=>f.name==='課本').parent).toBe('');
  }
});

test('第三種目錄可在未分類字庫後就地新增資料夾', async ({ page }) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[],units:[{id:'u1',name:'情書',folder:''}]})));
  await page.reload();
  await page.locator('[data-engine="wunder"]').click();
  await page.locator('.wb-title').filter({hasText:'情書'}).click();
  await page.getByRole('button',{name:'新增資料夾',exact:true}).click();
  const input=page.getByRole('textbox',{name:'新資料夾名稱'});
  await expect(input).toBeVisible();
  await input.fill('課本');
  await page.getByRole('button',{name:'新增',exact:true}).click();
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')));
  expect(draft.folders.find(f=>f.name==='課本').parent).toBe('');
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

test('Wunderbaum 以可見箭頭收合與展開資料夾', async ({ page }, testInfo) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'f1',name:'中文',parent:''},{id:'f2',name:'課本',parent:'f1'}],units:[]})));
  await page.reload();
  await page.locator('[data-engine="wunder"]').click();
  const row=page.locator('.wb-row').filter({has:page.locator('.wb-title').filter({hasText:'中文'})});
  const expander=row.locator('.wb-expander');
  await expect(expander).toHaveCount(1);
  await expect.poll(() => expander.evaluate(el => getComputedStyle(el,'::after').content)).toBe('"▾"');
  await expander.click();
  await expect(page.getByText('📁 課本',{exact:true})).toHaveCount(0);
  await expect.poll(() => expander.evaluate(el => getComputedStyle(el,'::after').content)).toBe('"▸"');
  await page.screenshot({path:`artifacts/${testInfo.project.name}-wunderbaum-visible-expander.png`,fullPage:true});
});

test('Wunderbaum 長目錄隨內容伸縮，頁面接收滾輪', async ({ page }) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'parent',name:'課本',parent:''}, ...Array.from({length:80},(_,i)=>({id:`f${i}`,name:`資料夾${i}`,parent:'parent'}))],units:[]})));
  await page.goto('/settings.html#treeTrial');
  const frame=page.frameLocator('iframe[title="字庫目錄試用比較"]');
  await frame.locator('[data-engine="wunder"]').click();
  const tree=frame.locator('#tree');
  const parent=frame.locator('.wb-row').filter({has:frame.locator('.wb-title').filter({hasText:'課本'})});
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

test('Wunderbaum 移動模式會標示可選目的地並阻止移入子資料夾', async ({ page }, testInfo) => {
  await page.goto('/tree_comparison.html');
  await page.evaluate(() => localStorage.setItem('wordflash_tree_trial_v1', JSON.stringify({folders:[{id:'f1',name:'中文',parent:''},{id:'f2',name:'課本',parent:'f1'},{id:'f3',name:'英文',parent:''}],units:[]})));
  await page.reload();
  await page.locator('[data-engine="wunder"]').click();
  const chinese=page.locator('.wb-row').filter({has:page.locator('.wb-title').filter({hasText:'中文'})});
  await chinese.locator('.wb-title').click();
  await page.getByRole('button',{name:'移動到…'}).click();
  const textbook=page.locator('.wb-row').filter({has:page.locator('.wb-title').filter({hasText:'課本'})});
  const english=page.locator('.wb-row').filter({has:page.locator('.wb-title').filter({hasText:'英文'})});
  await expect(chinese).toHaveClass(/move-blocked/);
  await expect(textbook).toHaveClass(/move-blocked/);
  await expect(english).toHaveClass(/move-target/);
  await page.screenshot({path:`artifacts/${testInfo.project.name}-wunderbaum-move-mode.png`,fullPage:true});
  await english.locator('.wb-title').click();
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('wordflash_tree_trial_v1')));
  expect(draft.folders.find(f=>f.id==='f1').parent).toBe('f3');
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
