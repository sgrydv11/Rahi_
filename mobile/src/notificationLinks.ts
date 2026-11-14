import type {Screen} from './navigation';
export function notificationScreen(link:unknown):Screen|undefined{
 if(typeof link!=='string')return;const chat=/^\/chat\?group=([1-9][0-9]{0,8})$/.exec(link);if(chat)return{kind:'chat',groupId:Number(chat[1])};
 const detail=/^\/(rides|bookings)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(link);if(detail)return{kind:detail[1]==='rides'?'ride':'booking',id:detail[2]};
}
