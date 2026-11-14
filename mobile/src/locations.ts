import { useEffect,useState } from 'react';
import { api as request } from './api';
const fallback:Record<string,string[]>={Indore:['Aurobindo','Luv Kush','Vijay Nagar'],Ujjain:['Nanakheda','D-Mart','Lal Gate'],Dewas:['Bus Stand','AB Road','Industrial Area'],Pithampur:['Bus Stand','Sector 1','Sector 3']};
export function useCityPoints(){const[catalog,setCatalog]=useState(fallback);useEffect(()=>{const c=new AbortController();request<Record<string,string[]>>('/locations',{signal:c.signal,auth:false}).then(v=>{if(!c.signal.aborted)setCatalog(v);}).catch(()=>{});return()=>c.abort();},[]);return (city:string)=>{const key=city.trim().toLowerCase().replace(/^(petampur|pethampur|pitampur)$/,'pithampur');return catalog[Object.keys(catalog).find(c=>c.toLowerCase()===key)||'']||[];};}
