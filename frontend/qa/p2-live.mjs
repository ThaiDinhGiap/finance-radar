import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
async function inspect(name){const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;console.log(name,'axe',violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));await page.screenshot({path:`qa/${name}-desktop.png`});await page.setViewportSize({width:320,height:844});console.log(name,'overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:`qa/${name}-mobile.png`});await page.setViewportSize({width:1440,height:1000});expect(violations).toEqual([]);}
await page.goto('http://127.0.0.1:5173/#articles');await expect(page.locator('.article-row').first()).toBeVisible();await page.getByRole('button',{name:/Xem Story/}).first().click();
await page.getByRole('button',{name:'Compare Coverage',exact:true}).click();await expect(page.locator('.coverage-grid .story-member').first()).toBeVisible();await inspect('coverage');
await page.getByRole('button',{name:'Chỉnh Story',exact:true}).click();await expect(page.getByRole('button',{name:'Áp dụng chỉnh Story'})).toBeVisible();await inspect('curation');await page.keyboard.press('Escape');
await page.goto('http://127.0.0.1:5173/#personal');await expect(page.getByRole('checkbox',{name:'FPT',exact:true})).toBeVisible();await page.getByRole('checkbox',{name:'FPT',exact:true}).check();await expect(page.locator('main .story-member').first()).toBeVisible();await inspect('personal');
await page.goto('http://127.0.0.1:5173/#entities');await page.getByText('Thêm quan hệ có dẫn chứng',{exact:true}).click();await expect(page.getByRole('radio').first()).toBeVisible();await inspect('entities');
console.log('Errors',errors);expect(errors).toEqual([]);await browser.close();
