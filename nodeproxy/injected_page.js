
//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function __in_iframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

function __replace_page(event) {
    var text="";
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

}


function __main(){
    if (window.__page_replaced){
        return;
    }
    window.__page_replaced = true;

    // if (!__in_iframe()) {
    //     var myBtn = document.getElementById("myBtn");
    //     myBtn.addEventListener("click", __replace_page);

    // }
}

__main();
