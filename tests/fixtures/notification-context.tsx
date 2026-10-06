import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemberInsightNotificationsFinal} from '../../src/member-insight-notifications-final';
import {MemberInsightUnifiedV4} from '../../src/member-insight-unified-v4';
import {DisplayModeSwitch} from '../../src/insight-display-mode';
import '../../src/insight-source-boundaries';
import '../../src/insight-device-scale.css';
import '../../src/insight-release';
function Fixture(){const[tab,setTab]=useState('notifications');return <><nav><button onClick={()=>setTab('notifications')}>本人通知を検証</button><button onClick={()=>setTab('likes')}>スキ履歴を検証</button></nav><DisplayModeSwitch/>{tab==='notifications'?<MemberInsightNotificationsFinal noteId="tester"/>:<MemberInsightUnifiedV4/>}</>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
