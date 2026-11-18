export function phoneKey(value:string|null|undefined):string {
 let digits=(value||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===11&&digits.startsWith('0'))digits=digits.slice(1);if(digits.length===10&&/^[6-9]/.test(digits))digits='91'+digits;return digits;
}
export function senderLabel(phone:string|null|undefined,contacts:Record<string,string>={}){return contacts[phoneKey(phone)]||phone||'Number unavailable';}
export function incomingMessage(message:{senderId:string},userId:string){return message.senderId!==userId;}
