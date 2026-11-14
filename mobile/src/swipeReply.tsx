import {useRef,type ReactNode} from 'react';
import {Animated,PanResponder} from 'react-native';
export function SwipeReply({children,reply,disabled}:{children:ReactNode;reply:()=>void;disabled?:boolean}){
 const latest=useRef({reply,disabled});latest.current={reply,disabled};const offset=useRef(new Animated.Value(0)).current;
 const responder=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>!latest.current.disabled&&g.dx>12&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,onPanResponderMove:(_,g)=>offset.setValue(Math.max(0,Math.min(80,g.dx))),onPanResponderRelease:(_,g)=>{if(g.dx>55)latest.current.reply();Animated.spring(offset,{toValue:0,useNativeDriver:true}).start();},onPanResponderTerminate:()=>Animated.spring(offset,{toValue:0,useNativeDriver:true}).start()})).current;
 return <Animated.View {...responder.panHandlers} style={{transform:[{translateX:offset}],width:'100%'}}>{children}</Animated.View>;
}
