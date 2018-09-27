
window.addEventListener("load", function(event) {
    alert("Suspicious page detected. Click to continue");
    var debased = atob(page_content);

    if (compressed){
        unzipped = pako.inflate(debased);
        text = String.fromCharCode.apply(null, new Uint8Array(unzipped));
    }else{
        text = debased;
    }

    // document.write(text);

    var dp = new DOMParser();
    var doc = dp.parseFromString(text, "text/html");

    // var meta = document.createElement('meta');
    // meta.httpEquiv = "Content-Security-Policy";
    // meta.content = "script-src  'unsafe-inline'";
    // doc.getElementsByTagName('head')[0].appendChild(meta);

    document.replaceChild(
        document.importNode(doc.documentElement, true),
        document.documentElement);

    /*document.addEventListener("DOMContentLoaded", function(){

      var meta = document.createElement('meta');
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = "script-src  'unsafe-inline'";
      document.getElementsByTagName('head')[0].appendChild(meta);
      });
    */

    // setTimeout(function(){alert("I am still here");}, 5000);
});
