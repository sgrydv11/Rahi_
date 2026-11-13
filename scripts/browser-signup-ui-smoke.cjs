// UI flow against the local app; OTP provider responses are simulated here.
// Real challenge expiry, password hashing and account creation are covered by EmailOtpIT.
const {chromium,expect}=require('../.tools/audit-playwright/node_modules/playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const password='Local-verified-password-123';
  let requested=false,verified=false;
  await page.route('**/api/v1/auth/registration/request',async route=>{
   const body=route.request().postDataJSON();
   assert.equal(body.identifier,'signup-ui@example.test');assert.equal(body.password,password);
   assert.equal(body.mobileNumber,'+919876543210');requested=true;
   await route.fulfill({json:{challengeId:'f03260f8-8bdf-4557-b334-85b04736e460',expiresIn:300,delivery:'EMAIL'}});
  });
  const user={id:'b573e1f3-40c7-4a36-8417-011dd3a2db48',email:'signup-ui@example.test',fullName:'FlexirRides member',role:'USER',travelPreference:'PASSENGER'};
  await page.route('**/api/v1/auth/otp/verify',async route=>{
   if(route.request().postDataJSON().code!=='543210')return route.fulfill({status:401,json:{detail:'The code is invalid or expired.'}});
   verified=true;await route.fulfill({json:{accessToken:'local-ui-session',tokenType:'Bearer',expiresIn:900,user}});
  });
  await page.route('**/api/v1/users/me',route=>route.fulfill({json:user}));
  await page.goto('http://127.0.0.1:5174/register');
  await page.getByLabel('Email address',{exact:true}).fill(user.email);
  await page.getByLabel('Mobile number',{exact:true}).fill('+919876543210');
  const field=page.getByLabel('Password',{exact:true});await field.fill(password);
  const eye=page.getByRole('button',{name:'Show password',exact:true});
  const inputBox=await field.boundingBox(),eyeBox=await eye.boundingBox();
  assert.ok(eyeBox.x>=inputBox.x+inputBox.width-60 && eyeBox.x+eyeBox.width<=inputBox.x+inputBox.width+1);
  await eye.click();await expect(field).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide password',exact:true}).click();await expect(field).toHaveValue(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();
  assert.ok(requested);assert.equal(verified,false);
  await expect(page.getByRole('button',{name:/Resend in/})).toBeDisabled();
  await page.screenshot({path:'.local/signup-verification-ui.png',fullPage:true});
  await page.getByLabel('Email code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Verify and create account'}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  assert.equal(verified,false);
  await page.getByLabel('Email code',{exact:true}).fill('543210');
  await page.getByRole('button',{name:'Verify and create account'}).click();
  await expect(page).toHaveURL(/\/profile$/);assert.equal(verified,true);
  await page.goto('http://127.0.0.1:5174/rides');
  await page.getByLabel('From City',{exact:true}).fill('Indore');
  await page.getByLabel('To City',{exact:true}).fill('Ujjain');
  await page.getByRole('button',{name:'Calendar',exact:true}).click();
  const date=page.getByLabel('Custom date',{exact:true});await expect(date).toHaveAttribute('type','date');
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const selected=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  await date.fill(selected);
  await expect(page.locator('input[name="departureDate"]')).toHaveValue(selected);
  await page.getByRole('switch',{name:'Women-only rides'}).check();
  await page.getByRole('switch',{name:'Women-only rides'}).uncheck();
  await page.screenshot({path:'.local/ride-search-compact-ui.png',fullPage:true});
  await page.getByRole('button',{name:'Search rides',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Available rides',exact:true})).toBeVisible();
  assert.ok(new URL(page.url()).searchParams.get('departureDate')===selected);
  await expect(page.getByText('Finding rides…',{exact:true})).not.toBeVisible();
  await page.screenshot({path:'.local/ride-results-compact-ui.png',fullPage:true});
  console.log('PASS: inline password eye, signup OTP stage/resend guard/wrong-code recovery/verification, calendar selection, women switch and compact results.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
