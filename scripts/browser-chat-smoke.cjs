// Local integration only: start the isolated backend on 8083 and frontend on 5174.
const { chromium, expect } = require('../.tools/audit-playwright/node_modules/playwright/test');
const assert = require('node:assert/strict');
const base='http://127.0.0.1:5174';
const password='Local-chat-test-'+Date.now();
const stamp=Date.now();
const driverMobile='+919'+String(stamp).slice(-9);
const riderMobile='+918'+String(stamp).slice(-9);
async function api(path,{body,token,status=200}={}) {
  const response=await fetch('http://127.0.0.1:8083/api/v1'+path,{
    method:body?'POST':'GET',headers:{...(body&&{'Content-Type':'application/json'}),...(token&&{Authorization:'Bearer '+token})},
    body:body&&JSON.stringify(body),signal:AbortSignal.timeout(20000),
  });
  assert.equal(response.status,status,path);
  return response.json();
}
async function account(kind) {
  const email=`chat-${kind}-${stamp}@qa.example.test`;
  await api('/mobile/auth/register',{body:{email,password,fullName:'Chat Tester',mobileNumber:kind==='driver'?driverMobile:riderMobile},status:201});
  return {...await api('/mobile/auth/login',{body:{email,password}}),email};
}
async function login(page,email) {
  await page.goto(base+'/login');
  await page.getByLabel('Email or mobile number',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.getByRole('heading',{name:'Your profile.',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Chat',exact:true}).click();
  await page.getByRole('heading',{name:'Ride community',exact:true}).waitFor();
}
(async()=>{
  await api('/chat/messages',{status:401});
  const driver=await account('driver'),rider=await account('passenger');
  const ride=await api('/rides',{token:driver.accessToken,status:201,body:{origin:'Indore',destination:'Ujjain',
    departureAt:new Date(Date.now()+86400000).toISOString(),timeZone:'Asia/Kolkata',totalSeats:2,pricePerSeat:100,currency:'INR',
    preferences:{boardingPoints:['Station'],droppingPoints:['Tower'],hasCar:true,ac:true,flexibleDropoff:false,womenOnly:false,routeType:'OTHER'}}});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const d=await browser.newContext(),p=await browser.newContext();
    const driverPage=await d.newPage(),passengerPage=await p.newPage();
    await login(driverPage,driverMobile);await login(passengerPage,rider.email);
    const message='Two seats to Ujjain '+stamp;
    await driverPage.getByLabel('Message',{exact:true}).fill(message);
    await driverPage.getByLabel('Share my mobile number with this message').check();
    await driverPage.getByText('＋ Share a ride',{exact:true}).click();
    await driverPage.getByRole('button',{name:'Load my rides to share',exact:true}).click();
    await expect(driverPage.getByRole('combobox')).toContainText('Indore');
    await driverPage.getByRole('combobox').selectOption(ride.id);
    await driverPage.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(passengerPage.getByText(message,{exact:true})).toBeVisible({timeout:12000});
    const card=passengerPage.getByRole('article').filter({hasText:message});
    await expect(card).toContainText('2 seats available');
    await expect(card).toContainText(driverMobile);
    await expect(card).toContainText('Unverified number');
    await card.getByRole('button',{name:`View member details for ${driverMobile}`,exact:true}).click();
    const details=passengerPage.getByRole('dialog',{name:'Member details'});
    await expect(details).toContainText('Chat Tester');
    await expect(details).toContainText(driverMobile);
    await expect(details).toContainText('Member since');
    await expect(details).not.toContainText(driver.email);
    await details.getByRole('button',{name:'Close',exact:true}).click();
    await card.getByRole('link',{name:'View ride / book seats'}).click();
    await passengerPage.getByRole('button',{name:'Book Seat',exact:true}).click();
    await passengerPage.getByRole('combobox',{name:'Boarding point',exact:true}).selectOption('Station');
    await passengerPage.getByRole('combobox',{name:'Dropping point',exact:true}).selectOption('Tower');
    const person=passengerPage.getByRole('group',{name:'Passenger 1',exact:true});
    await person.getByLabel('Name',{exact:true}).fill('Chat Passenger');
    await person.getByLabel('Age',{exact:true}).fill('28');
    await person.getByRole('combobox',{name:'Gender',exact:true}).selectOption('FEMALE');
    await passengerPage.getByRole('button',{name:'Review booking',exact:true}).click();
    await passengerPage.getByRole('button',{name:'Confirm booking',exact:true}).click();
    await expect(passengerPage).toHaveURL(/\/bookings\//);
    assert.equal((await api('/rides/'+ride.id)).availableSeats,1);
    await expect(driverPage.getByRole('article').filter({hasText:message})).toContainText('1 seats available',{timeout:12000});
    await passengerPage.goto(base+'/chat');
    const reply='Booked a seat, thank you '+stamp;
    const original=passengerPage.getByRole('article').filter({hasText:message});
    await original.getByRole('button',{name:'Reply to Chat Tester',exact:true}).click();
    await expect(passengerPage.getByText('Replying to Chat Tester',{exact:true})).toBeVisible();
    await passengerPage.getByRole('button',{name:'Cancel reply',exact:true}).click();
    await expect(passengerPage.getByText('Replying to Chat Tester',{exact:true})).toHaveCount(0);
    await original.getByRole('button',{name:'Reply to Chat Tester',exact:true}).click();
    await passengerPage.getByLabel('Message',{exact:true}).fill(reply);
    await passengerPage.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(driverPage.getByText(reply,{exact:true})).toBeVisible({timeout:12000});
    await expect(driverPage.getByRole('article').filter({hasText:reply}).getByRole('blockquote')).toContainText(message);
    await passengerPage.reload();
    await expect(passengerPage.getByText(reply,{exact:true})).toBeVisible();
    await expect(passengerPage.getByRole('article').filter({hasText:reply}).getByRole('blockquote')).toContainText(message);
    await passengerPage.setViewportSize({width:390,height:844});
    await expect(passengerPage.getByRole('navigation',{name:'App navigation'}).getByRole('link',{name:'Chat',exact:true})).toBeVisible();
    await passengerPage.screenshot({path:'.local/chat-mobile-web.png',fullPage:true});
    console.log('PASS: phone-login, member details/privacy, quoted reply/cancel/reload, two-user live chat, driver ride sharing, booking from a chat card, live seat update, reply, reload persistence and mobile footer.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
