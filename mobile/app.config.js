const fs=require('fs');
module.exports=({config})=>{
 const file=process.env.GOOGLE_SERVICES_JSON||(fs.existsSync('./google-services.json')?'./google-services.json':undefined);
 return {...config,android:{...config.android,...(file?{googleServicesFile:file}:{})},plugins:[...(config.plugins||[]).filter(p=>(Array.isArray(p)?p[0]:p)!=='expo-notifications'),['expo-contacts',{contactsPermission:'Allow FlexiRides to show saved contact names in chat. Contacts stay on your phone.'}],['expo-location',{locationWhenInUsePermission:'Allow FlexiRides to find your nearby city when you tap Use current city.'}],['expo-notifications',{color:'#245EEA',defaultChannel:'travel-updates'}]],extra:{...config.extra,pushConfigured:!!file}};
};
