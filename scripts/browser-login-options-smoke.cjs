// UI-only email transport stub; real OTP verification is covered by EmailOtpIT.
const {chromium,expect}=require('../.tools/audit-playwright/node_modules/playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const user={id:'11111111-1111-4111-8111-111111111111',email:'login-ui@example.test',fullName:'Login Tester',role:'USER',travelPreference:'PASSENGER'};
  await page.route('**/api/v1/auth/otp/request',async route=>{
   assert.equal(route.request().postDataJSON().identifier,user.email);
   await route.fulfill({json:{challengeId:'test-challenge',expiresIn:300,delivery:'EMAIL'}});
  });
  await page.route('**/api/v1/auth/otp/verify',async route=>{
   if(route.request().postDataJSON().code!=='543210')return route.fulfill({status:401,json:{detail:'The code is invalid or expired.'}});
   await route.fulfill({json:{accessToken:'ui-session',expiresIn:900,user}});
  });
  await page.route('**/api/v1/users/me',route=>route.fulfill({json:user}));
  await page.goto('http://127.0.0.1:5174/login');
  await expect(page.getByLabel('Email or mobile number',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Email code',exact:true}).click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByRole('button',{name:'Send email OTP',exact:true}).click();
  await expect(page.getByRole('button',{name:/Resend in/})).toBeDisabled();
  await page.getByLabel('Email code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  await page.screenshot({path:'.local/email-login-options.png',fullPage:true});
  await page.getByLabel('Email code',{exact:true}).fill('543210');
  await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
  await expect(page).toHaveURL(/\/profile$/);
  console.log('PASS email-code login UI: mode switch, resend cooldown, rejected code and successful session');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
