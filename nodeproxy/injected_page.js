
//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}


function replace_page(event) {
    console.log(document.domain,inIframe())
    if (inIframe() === false) {
      alert("Suspicious page detected. Click to continue");
    }
    window.removeEventListener("load", replace_page);

    var debased = atob(page_content);

    if (compressed){
        unzipped = pako.inflate(debased);
        text = String.fromCharCode.apply(null, new Uint8Array(unzipped));
    }else{
        text = decodeURIComponent(escape(debased));
    }

    setTimeout(function(){
        document.open();
        document.write(text);
        document.close();
    }, 1);


    // setTimeout(function(){
    //     var dp = new DOMParser();
    //     var doc = dp.parseFromString(text, "text/html");
    //     document.replaceChild(
    //         document.importNode(doc.documentElement, true),
    //         document.documentElement);
    // }, 1);




    // var meta = document.createElement('meta');
    // meta.httpEquiv = "Content-Security-Policy";
    // meta.content = "script-src  'unsafe-inline'";
    // doc.getElementsByTagName('head')[0].appendChild(meta);

    // evt = document.createEvent('Event');
    // evt.initEvent('load', false, false);
    // window.dispatchEvent(evt);

    // document.replaceChild(
    //     document.importNode(doc.documentElement, true),
    //     document.documentElement);

    // setTimeout(function(){
    //     console.log("after timeout");
    //     var evt = document.createEvent('Event');
    //     evt.initEvent('load', false, false);
    //     window.dispatchEvent(evt);
    // }, 1000);


    /*document.addEventListener("DOMContentLoaded", function(){

      var meta = document.createElement('meta');
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = "script-src  'unsafe-inline'";
      document.getElementsByTagName('head')[0].appendChild(meta);
      });
    */

    // setTimeout(function(){alert("I am still here");}, 5000);
}


// window.addEventListener("load", replace_page);

replace_page();
