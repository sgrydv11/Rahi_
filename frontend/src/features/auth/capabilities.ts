import type {User} from './auth';
export const canOffer=(user:User|null)=>!!user&&user.travelPreference!=='PASSENGER';
export const canBook=(user:User|null)=>!user||user.travelPreference!=='DRIVER';
