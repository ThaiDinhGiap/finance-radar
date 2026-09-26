import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
await page.goto('http://127.0.0.1:5173/#articles');
await expect(page.locator('.article-row').first()).toBeVisible();
await page.getByRole('button',{name:/Xem Story/}).first().click();
await expect(page.getByRole('dialog').locator('.story-member').first()).toBeVisible();
await page.getByRole('button',{name:'Timeline Story',exact:true}).click();
await expect(page.locator('.timeline-list li').first()).toBeVisible();
await page.screenshot({path:'qa/timeline-story.png'});
await page.getByRole('button',{name:'Xóa phạm vi Timeline'}).click();
await page.getByLabel('Thời gian Timeline').selectOption('7');
for(const route of ['timeline','digest','operations','alerts']) {
 await page.goto(`http://127.0.0.1:5173/#${route}`);
 await expect(page.locator('main h1:visible')).toBeVisible();
 if(route==='timeline')await expect(page.locator('.timeline-list li').first()).toBeVisible();
 if(route==='operations')await expect(page.locator('.metric-grid dd').first()).not.toHaveText('—');
 if(route==='digest') {await page.locator('input[type=date]').fill('2026-09-25');await expect(page.locator('.citation-list a').first()).toBeVisible();}
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
 console.log(route,'axe',violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
 await page.screenshot({path:`qa/${route}-desktop.png`});
 await page.setViewportSize({width:320,height:844});
 console.log(route,'overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:`qa/${route}-mobile.png`});
 await page.setViewportSize({width:1440,height:1000});
 if(route==='operations') {
  await page.getByRole('button',{name:'Data Quality',exact:true}).click();
  await expect(page.getByLabel('Loại vấn đề chất lượng')).toBeVisible();
  await page.getByLabel('Loại vấn đề chất lượng').selectOption('NOT_INDEXED');
  console.log('quality axe',(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id));
  await page.screenshot({path:'qa/quality-desktop.png'});
 }
}
console.log('Errors',errors);expect(errors).toEqual([]);
await browser.close();
