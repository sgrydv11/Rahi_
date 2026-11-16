// Local UI tests with mocked provider checkout. Never sends payment/card data to a provider.
const {chromium,expect}=require('../.tools/audit-playwright/node_modules/playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const base='http://127.0.0.1:5175',email=`wallet-browser-${Date.now()}@qa.example.test`,password='Wallet-browser-test-password-long';
 const registered=await fetch('http://127.0.0.1:8084/api/v1/mobile/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,fullName:'Wallet QA',travelPreference:'BOTH'})});assert.equal(registered.status,201);
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage();let enabled=false,available=10000,pending=false,topUps=0;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/v1/wallet**',async route=>{const req=route.request(),url=new URL(req.url());let body;
   if(url.pathname.endsWith('/options'))body={mode:'test',razorpayEnabled:enabled,stripeEnabled:enabled,simulatedWithdrawalsEnabled:true};
   else if(url.pathname.endsWith('/transactions'))body={content:[],totalPages:0};
   else if(url.pathname.endsWith('/withdrawals')&&req.method()==='POST'){const amount=req.postDataJSON().amountPaise;if(amount>available)return route.fulfill({status:409,json:{detail:'Your available balance is too low.'}});available-=amount;body={id:'withdrawal-test',amountPaise:amount,status:'PENDING'};}
   else if(url.pathname.endsWith('/withdrawals/withdrawal-test'))body={id:'withdrawal-test',amountPaise:1000,status:'SUCCEEDED'};
   else if(url.pathname.endsWith('/top-ups')&&req.method()==='POST'){assert.equal(req.postDataJSON().provider,'razorpay');topUps++;pending=true;body={operation:{id:'topup-test',amountPaise:1000,status:'PENDING'},checkout:{provider:'razorpay',keyId:'rzp_test_fixture',orderId:'order_fixture'}};}
   else if(url.pathname.endsWith('/sync')){if(pending){available+=1000;pending=false;}body={id:'topup-test',amountPaise:1000,status:'SUCCEEDED'};}
   else body={availablePaise:available,reservedPaise:0};
   await route.fulfill({json:body});
  });
  await page.route('https://checkout.razorpay.com/v1/checkout.js',route=>route.fulfill({contentType:'application/javascript',body:'window.Razorpay=class {constructor(o){this.o=o}open(){setTimeout(()=>this.o.handler({razorpay_payment_id:"pay_fixture",razorpay_signature:"fixture"}),100)}}'}));
  await page.goto(base+'/login');await page.getByLabel('Email or mobile number',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();await page.waitForURL(u=>u.pathname!=='/login');await page.goto(base+'/wallet');
  await expect(page.getByRole('heading',{name:'Test wallet',exact:true})).toBeVisible();await page.getByLabel('Amount in INR',{exact:true}).fill('10');await expect(page.getByRole('button',{name:'Add test money',exact:true})).toBeDisabled();
  enabled=true;await page.getByRole('button',{name:'Refresh balance'}).click();await expect(page.getByRole('button',{name:'Add test money',exact:true})).toBeEnabled();
  await page.getByLabel('Payment provider',{exact:true}).selectOption('stripe');await expect(page.getByText(/4242 4242 4242 4242/)).toBeVisible();await page.getByLabel('Payment provider',{exact:true}).selectOption('razorpay');
  await page.getByRole('button',{name:'Add test money',exact:true}).click();await expect(page.getByRole('status')).toContainText('Test wallet credited');assert.equal(topUps,1);
  await page.getByLabel('Withdrawal amount in INR',{exact:true}).fill('10000');await page.getByRole('button',{name:'Request test withdrawal'}).click();await expect(page.getByRole('alert')).toContainText('balance is too low');
  await page.getByLabel('Withdrawal amount in INR',{exact:true}).fill('10');await page.getByRole('button',{name:'Request test withdrawal'}).click();await expect(page.getByRole('button',{name:'Check withdrawal status'})).toBeVisible();await page.getByRole('button',{name:'Check withdrawal status'}).click();await expect(page.getByText(/SUCCEEDED/)).toBeVisible();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
  await page.screenshot({path:'.local/wallet-browser-desktop.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: missing-key gate, provider selection/card guidance, mocked Razorpay top-up, insufficient funds, simulated withdrawal/status and four responsive widths. Local fixtures only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
