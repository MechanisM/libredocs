function signin() {
  document.getElementById("signin-button").style.display='none';
  document.getElementById("signin-checking").style.display='inline';
  var email = document.getElementById('email').value;
  navigator.id.get(function(assertion) {
    if(assertion) {
      remoteStorageClient.signIn('http://libredocs.org', assertion);
      window.location.href = 'signin.html';
    }
  }, {
    requiredEmail: email
  });
}
function allow() {
  if(!sessionObj) {
    sessionObj = JSON.parse(localStorage.getItem('sessionObj'));
  }
  if(sessionObj.storageInfo.auth.indexOf('?') == -1) {
    window.open(sessionObj.storageInfo.auth
      +'?redirect_uri='+encodeURIComponent('http://libredocs.org/rcvToken.html')
      +'&scope='+encodeURIComponent('documents'));
  } else {
    window.open(sessionObj.storageInfo.auth
      +'&redirect_uri='+encodeURIComponent('http://libredocs.org/rcvToken.html')
      +'&scope='+encodeURIComponent('documents'));
  }
  window.addEventListener('message', function(event) {
    if(event.origin == location.protocol +'//'+ location.host) {
      if(!sessionObj) {
        sessionObj = JSON.parse(localStorage.sessionObj);
      }
      sessionObj.bearerToken = event.data;
      sessionObj.state = 'ready';
      sessionObj.proxy = '';
      sessionObj.clientSide = true;//prevents storing with migration fields in account.js
      localStorage.sessionObj = JSON.stringify(sessionObj);
      document.getElementById('allowButton').style.display='none';
      checkForLogin();
    }
  }, false);
  }
}
function couldBeEmail(str) {
  return /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(str);
}
function checkEmail() {
  document.getElementById('allow-button').style.display='none';
  document.getElementById('signin-button').style.display='none';
  var email = document.getElementById('email').value;
  if(!couldBeEmail(email)) {
   return;
  }
  document.getElementById('signin-checking').style.display='inline';
  require(['http://unhosted.org/remoteStorage-0.4.3.js'], function(remoteStorage) {
    remoteStorage.getStorageInfo(email, function(err, storageInfo) {
      if(err) {
        document.getElementById('signin-checking').style.display='none';
        document.getElementById('signin-button').style.display='inline';
        document.getElementById('allow-button').style.display='none';
      } else {
        var email = document.getElementById('email').value;
        var sessionObj = { 
          userAddress: email,
          storageInfo: storageInfo,
          state: 'allowRemoteStorage'
        };
        localStorage.sessionObj = JSON.stringify(sessionObj);
        document.getElementById('signin-checking').style.display='none';
        document.getElementById('allow-button').style.display='inline';
        document.getElementById('signin-button').style.display='none';
      }
    });
  });
}

if(localStorage.getItem('sessionObj')) {
  window.location.href = 'signin.html';
}
document.getElementById('signin-button').onclick = signin;
document.getElementById('allow-button').onclick = allow;
document.getElementById('email').onkeyup = checkEmail;

(function($) {
  $(document).ready(function() {
    $('#signin').tooltip();
    $('.signin').onmouseover=$('#signin').tooltip('show');
  });
})(jQuery);
