// Local isolated test server only; never targets production or sends provider mail.
const assert=require('node:assert/strict');
const base=process.env.AUTH_TEST_API || 'http://127.0.0.1:8083/api/v1';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local test API required.');
const stamp=Date.now(),password='Security-test-password-'+stamp;
async function request(path,{body,token,status=200}={}) {
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body&&{'Content-Type':'application/json'}),...(token&&{Authorization:'Bearer '+token})},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,status,path);
 return response.status===204?null:response.json();
}
(async()=>{
 const email=`security-${stamp}@qa.example.test`,mobile='+917'+String(stamp).slice(-9);
 await request('/mobile/auth/register',{body:{email,password,fullName:'Security Tester',mobileNumber:mobile},status:201});
 for(let n=0;n<5;n++)await request('/mobile/auth/login',{body:{email,password:'incorrect'},status:401});
 await request('/mobile/auth/login',{body:{email:mobile,password},status:401});
 const second=`session-${stamp}@qa.example.test`;
 await request('/mobile/auth/register',{body:{email:second,password,fullName:'Session Tester'},status:201});
 const login=await request('/mobile/auth/login',{body:{email:second,password}});
 assert.equal(login.user.role,'USER');
 assert.ok(JSON.parse(Buffer.from(login.accessToken.split('.')[1],'base64url')).sid);
 await request('/rides/me',{token:login.accessToken});
 await request('/mobile/auth/logout',{body:{refreshToken:login.refreshToken},status:204});
 await request('/rides/me',{token:login.accessToken,status:401});
 await request('/mobile/auth/refresh',{body:{refreshToken:login.refreshToken},status:401});
 console.log('PASS packaged HTTP: five-failure account lock across email/mobile, session-bound token and immediate access/refresh revocation');
})().catch(error=>{console.error(error);process.exitCode=1;});
