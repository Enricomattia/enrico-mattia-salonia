// This callback never loads the archive or saves credentials.
(()=>{
  const values=new URLSearchParams(location.hash.slice(1));
  history.replaceState(null,'',location.pathname);
  const token=values.get('access_token'),state=values.get('state');
  if(!window.opener||!state||state.length>200){document.getElementById('connectionStatus').textContent='Open Connect Netlify from Πathos again and keep that window open.';return;}
  const valid=typeof token==='string'&&/^[A-Za-z0-9._~+\/=-]{10,8192}$/.test(token);
  window.opener.postMessage({type:'pathos-netlify-auth',state,token:valid?token:null,error:valid?'':'Netlify connection was cancelled or refused.'},location.origin);
  document.getElementById('connectionStatus').textContent=valid?'Connected. Return to Πathos.':'Connection cancelled. Return to Πathos to try again.';
  window.close();
})();
