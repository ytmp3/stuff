
//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function __in_iframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

function __replace_page() {
    var text="";
    var debased = atob(page_content);

    if (compressed){
        unzipped = pako.inflate(debased);
        text = String.fromCharCode.apply(null, new Uint8Array(unzipped));
    }else{
        try{
            text = decodeURIComponent(escape(debased));
        }catch(e){
            console.log(e);
            text = debased;
        }
    }

    setTimeout(function(){
        alert('still here');
    }, 10000);
    document.open();
    document.write(text);
    document.close();

}


function __main(){
    if (window.__page_replaced){
        return;
    }
    window.__page_replaced = true;

    if (__in_iframe()) {
        __replace_page();
    }

    // if (!__in_iframe()) {
    //     var myBtn = document.getElementById("myBtn");
    //     myBtn.addEventListener("click", __replace_page);

    // }
}

__main();
