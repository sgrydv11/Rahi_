// Local fixture data only. Audits every web route family at phone/tablet/desktop widths.
const {chromium,expect}=require('../.tools/audit-playwright/node_modules/playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:5174',stamp=Date.now(),password='Website-audit-password-'+stamp;
async function api(path,{body,token,key,status=200}={}) {
 const r=await fetch('http://127.0.0.1:8083/api/v1'+path,{method:body?'POST':'GET',headers:{...(body&&{'Content-Type':'application/json'}),...(token&&{Authorization:'Bearer '+token}),...(key&&{'Idempotency-Key':key})},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,status,path);return r.json();
}
async function account(kind) {
 const email=`website-${kind}-${stamp}@qa.example.test`,mobileNumber='+919'+String(stamp+(kind==='driver'?0:1)).slice(-9);
 await api('/mobile/auth/register',{status:201,body:{email,password,fullName:'Website '+ 'A'.repeat(90),mobileNumber}});
 return {...await api('/mobile/auth/login',{body:{email,password}}),email,mobileNumber};
}
(async()=>{
 const driver=await account('driver'),passenger=await account('passenger');
 const departureAt=new Date(Date.now()+86400000).toISOString();
 const rideBody={origin:'Indore',destination:'Ujjain',departureAt,timeZone:'Asia/Kolkata',totalSeats:3,pricePerSeat:100,currency:'INR',notes:'N'.repeat(800),
  preferences:{boardingPoints:['Station'],droppingPoints:['Tower'],hasCar:true,ac:true,flexibleDropoff:false,womenOnly:false,routeType:'OTHER'}};
 const ride=await api('/rides',{token:driver.accessToken,status:201,body:rideBody});
 const editable=await api('/rides',{token:driver.accessToken,status:201,body:rideBody});
 const booking=await api(`/rides/${ride.id}/bookings`,{token:passenger.accessToken,status:201,key:crypto.randomUUID(),body:{seats:1,rideVersion:ride.version,details:{boardingPoint:'Station',droppingPoint:'Tower',passengers:[{name:'Audit Passenger',age:27,gender:'FEMALE'}]}}});
 const chatBody='Website contact check '+stamp;
 await api('/chat/messages',{token:driver.accessToken,body:{clientId:crypto.randomUUID(),body:chatBody,sharePhone:true}});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const report={widths:[320,375,768,1280],pages:[],links:[],failures:[],pageErrors:[]};
 try {
  const page=await browser.newPage({viewport:{width:320,height:844}});
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  await page.goto(base+'/login');
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Main navigation',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeFocused();
  await page.getByLabel('Email or mobile number',{exact:true}).fill(driver.email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/profile$/);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(departureAt));
  const paths=['/','/help','/login','/register','/rides',`/rides?origin=Indore&destination=Ujjain&departureDate=${day}`,
   '/rides/new','/rides/mine',`/rides/${ride.id}`,`/rides/${editable.id}/edit`,`/rides/${ride.id}/bookings`,
   '/bookings/mine',`/bookings/${booking.id}`,'/profile','/vehicles','/notifications','/chat','/missing-audit-page'];
  const links=new Set();
  for(const width of report.widths) {
   await page.setViewportSize({width,height:844});
   for(const path of paths) {
    await page.goto(base+path);await page.locator('main h1').waitFor();await page.locator('.primary-navigation [role="status"]').waitFor({state:'detached'});
    await page.waitForTimeout(200);
    const item=await page.evaluate(()=>({path:location.pathname,title:document.title,description:document.querySelector('meta[name=description]')?.content,
     width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
     overflow:[...document.querySelectorAll('main *,header *,footer *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && e.getBoundingClientRect().width>0).slice(0,8).map(e=>`${e.tagName}.${e.className}`)}));
    report.pages.push(item);
    if(item.scrollWidth>width+1){report.failures.push(item);await page.screenshot({path:`.local/site-overflow-${width}-${paths.indexOf(path)}.png`,fullPage:true});}
    assert.ok(item.description?.length>30,path+' description');assert.ok(item.title.endsWith('| FlexirRides'),path+' title');
    for(const href of await page.locator('a[href]').evaluateAll(anchors=>anchors.map(a=>a.getAttribute('href'))))if(href.startsWith('/'))links.add(href);
   }
  }
  for(const path of links) {
   await page.goto(base+path);await page.locator('main h1').waitFor();await page.locator('.primary-navigation [role="status"]').waitFor({state:'detached'});
   assert.notEqual(await page.title(),'Page not found | FlexirRides',path+' broken link');
   report.links.push(path);
  }
  await page.setViewportSize({width:375,height:844});await page.goto(base+'/profile');
  await expect(page.getByRole('link',{name:driver.email,exact:true})).toHaveAttribute('href','mailto:'+driver.email);
  await page.getByLabel('Full name',{exact:true}).fill('Website Tester');await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Profile saved.');
  await page.route('**/api/v1/users/me',route=>route.request().method()==='PATCH'?route.fulfill({status:503,json:{detail:'Please try again later.'}}):route.continue());
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Please try again later.');
  await page.unroute('**/api/v1/users/me');
  await page.goto(base+'/chat');const message=page.getByRole('article').filter({hasText:chatBody});
  await message.getByRole('button',{name:`View member details for ${driver.mobileNumber}`,exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('link',{name:/Call /})).toHaveAttribute('href','tel:'+driver.mobileNumber);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.goto(base+'/help');await page.screenshot({path:'.local/site-help-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.screenshot({path:'.local/site-menu-mobile.png',fullPage:true});
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Find a ride',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open menu',exact:true})).toHaveAttribute('aria-expanded','false');
  await page.getByRole('link',{name:'FlexirRides home',exact:true}).click();await expect(page).toHaveURL(base+'/');
  await expect(page.locator('.site-footer')).toContainText('© '+new Date().getFullYear());
  const icon=await page.request.get(base+'/favicon.png');assert.equal(icon.status(),200);assert.ok((await icon.body()).length<5000);
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'You have been logged out.'})).toBeVisible();
  fs.writeFileSync('.local/site-audit-results.json',JSON.stringify(report,null,2));
  assert.deepEqual(report.failures,[],'horizontal overflow');assert.deepEqual(report.pageErrors,[],'browser errors');
  console.log(`PASS website audit: ${report.pages.length} route/viewport checks, ${report.links.length} internal links, menu, metadata, contacts, favicon, success/error and logout feedback`);
 } finally {fs.writeFileSync('.local/site-audit-results.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
