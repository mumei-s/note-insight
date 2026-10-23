// Local browser-test fixture only. All API traffic is intercepted by the test.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemberInsightOutgoingComments } from '../../src/member-insight-outgoing-comments';
localStorage.setItem('mumei-insight-access-token', 'test-only-session');
createRoot(document.getElementById('root')!).render(<MemberInsightOutgoingComments noteId="self" />);
