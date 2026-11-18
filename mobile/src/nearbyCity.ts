// Approximate nearby city for the supported corridor; coordinates stay on device.
const cities=[{name:'Indore',lat:22.7196,lon:75.8577},{name:'Ujjain',lat:23.1765,lon:75.7885},{name:'Dewas',lat:22.9676,lon:76.0534},{name:'Pithampur',lat:22.6197,lon:75.6933}];
export function nearbyCity(latitude:number,longitude:number):string|null {
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
 const rad=Math.PI/180;let closest:string|null=null,distance=25;
 for(const city of cities){const a=Math.sin((city.lat-latitude)*rad/2)**2+Math.cos(latitude*rad)*Math.cos(city.lat*rad)*Math.sin((city.lon-longitude)*rad/2)**2;const km=12742*Math.asin(Math.sqrt(Math.min(1,a)));if(km<distance){distance=km;closest=city.name;}}
 return closest;
}
