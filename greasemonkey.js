// ==UserScript==
// @name     clientpoc
// @version  1
// @grant    none
// ==/UserScript==

(function(d, script) {
    script = d.createElement('script');
    script.type = 'text/javascript';
    //script.async = true;
    /*script.onload = function(){
        // remote script has loaded
    };*/
    script.src = 'https://rawgit.com/ytmp3/stuff/master/clientpoc.js';
  	//script.src = 'http://localhost:1234/clientpoc.js';
    d.getElementsByTagName('head')[0].appendChild(script);
}(document));
