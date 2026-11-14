// This callback never loads the archive or saves credentials.
(()=>{
  const values=new URLSearchParams(location.hash.slice(1));
  history.replaceState(null,'',location.pathname);
  const token=values.get('access_token'),state=values.get('state');
  const feedback=document.getElementById('connectionStatus');
  if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(state||'')){
    feedback.textContent='Start again from Connect Netlify in Πathos and keep that window open.';
    return;
  }
  const valid=typeof token==='string'&&/^[A-Za-z0-9._~+\/=-]{10,8192}$/.test(token);
  const message={type:'pathos-netlify-auth',state,token:valid?token:null};
  const opener=window.opener;
  let channel;
  try{channel=new BroadcastChannel('pathos-netlify-auth:'+state);}catch{}
  if(channel){
    channel.onmessage=event=>{
      if(event.data?.type!=='pathos-netlify-received'||event.data.state!==state)return;
      clearTimeout(timeout);channel.close();
      feedback.textContent=valid?'Sign-in returned to Πathos. You can close this tab.':'Return to Πathos to try again.';
      if(opener)window.close();
    };
    channel.postMessage(message);
  }
  // Keep the opener path for browsers without BroadcastChannel and cached older app shells.
  try{opener?.postMessage(message,location.origin);}catch{}
  const timeout=setTimeout(()=>{
    channel?.close();
    feedback.textContent='Πathos did not confirm the connection. Return to the original tab or app window and try again.';
    // With only the opener available, the callback cannot check receipt.
    if(opener&&!channel){feedback.textContent='Return to Πathos to check the connection.';window.close();}
  },5000);
})();
