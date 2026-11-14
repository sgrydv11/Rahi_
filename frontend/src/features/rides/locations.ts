import { useEffect,useState } from 'react';
import { api } from '../../lib/api/client';
const fallback:Record<string,string[]>={Indore:['Aurobindo','Luv Kush','Vijay Nagar'],Ujjain:['Nanakheda','D-Mart','Lal Gate'],Dewas:['Bus Stand','AB Road','Industrial Area'],Pithampur:['Bus Stand','Sector 1','Sector 3']};
export function useCityPoints(){const[catalog,setCatalog]=useState(fallback);useEffect(()=>{const c=new AbortController();api<Record<string,string[]>>('/locations',{signal:c.signal}).then(v=>{if(!c.signal.aborted)setCatalog(v);}).catch(()=>{});return()=>c.abort();},[]);return (city:string)=>{const key=city.trim().toLowerCase().replace(/^(petampur|pethampur|pitampur)$/,'pithampur');return catalog[Object.keys(catalog).find(c=>c.toLowerCase()===key)||'']||[];};}
