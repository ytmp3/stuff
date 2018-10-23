var overlay = `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.4.10/dialog-polyfill.js" integrity="sha256-MzKeKXV3W7bf3Uu0xLNN/SiVj3OBfBUzD3VmMb/yyCQ=" crossorigin="anonymous"></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.4.10/dialog-polyfill.css" integrity="sha256-hT0ET4tfm+7MyjeBepBgV2N5tOmsAVKcTWhH82jvoaA=" crossorigin="anonymous" />
    <style>
      dialog {
      border: 0;
      padding: 20px;
      }

      dialog + .backdrop {
      background-color: rgba(0,255,0,0.5);
      }

      dialog::backdrop { /* native */
      background-color: rgba(0,255,0,0.5);
      }

    </style>

    <dialog id="myNav" >
      <div>
        Navigation to this site is restricted by company policy.
        <button id="myBtn">Submit</button>
      </div>
    </dialog>
`;


var TIME_ALLOWED_SEC = 60;


function pause_media(type){
    for (let v of document.getElementsByTagName(type)){
        v.pause();
    }
}

function pause_iframes(){
    console.log("pause_iframes");
    for (let iframe of document.getElementsByTagName('iframe')){
		var iframeSrc = iframe.src;
		iframe.src = iframeSrc;
	}
}

function play_media(type){
    for (let v of document.getElementsByTagName(type)){
        v.play();
    }
}



function init_pause_video_timer(){
    localStorage._pause_video_timer_ = -1;
    pause_iframes();
}

function start_pause_video_timer()
{
    if (!localStorage._pause_video_timer_){
        init_pause_video_timer();
    }

    if (localStorage._pause_video_timer_ != -1){
        console.log("already have a timer");
        stop_pause_video_timer();
    }

    let timer = setInterval(()=>{
        pause_media('audio');
        pause_media('video');
    }, 500);
    localStorage._pause_video_timer_ = timer;
    console.log("starting pause_video_timer: ", timer);

}

function stop_pause_video_timer()
{
    if (localStorage._pause_video_timer_ &&
        localStorage._pause_video_timer_ != -1){
        let timer = localStorage._pause_video_timer_;
        console.log("stopping pause_video_timer: ", timer);
        clearInterval(timer);
        localStorage._pause_video_timer_ = -1;
    }
}


//https://stackoverflow.com/questions/326069/how-to-identify-if-a-webpage-is-being-loaded-inside-an-iframe-or-directly-into-t
function running_in_iframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}


function on_overlay_timer_expired(){
    console.log("overlay timer expired");
    show_overlay();
}



function start_overlay_timer(restart=false){
    if (!localStorage._overlay_last_ || restart){
        localStorage._overlay_last_ = Date.now(); // msec
    }

    remainingMsec = TIME_ALLOWED_SEC * 1000 -
        (Date.now() - localStorage._overlay_last_);

    console.log("overlay timer started: ", remainingMsec);
    setTimeout(on_overlay_timer_expired, remainingMsec);
}


function on_overlay_button_clicked(){
    hide_overlay();
    start_overlay_timer(true);
}

function insert_overlay(){
    var temp = document.createElement('template');
    temp.innerHTML = overlay;
    var frag = temp.content;
    document.body.appendChild(frag);

    var dialog = document.querySelector('dialog');
    dialogPolyfill.registerDialog(dialog);

    var myBtn = document.getElementById("myBtn");
    myBtn.addEventListener("click", on_overlay_button_clicked);
}


function show_overlay(){
    var myNav = document.getElementById("myNav");
    if (!myNav){
        insert_overlay();
        myNav = document.getElementById("myNav");
    }
    var dialog = document.querySelector('dialog');
    dialog.showModal();
    start_pause_video_timer();
}

function hide_overlay(){
    var myNav = document.getElementById("myNav");
    myNav.style.width = "0%";
    var dialog = document.querySelector('dialog');
    dialog.close();
    stop_pause_video_timer();
    play_media("video");
    play_media("audio");
}

function is_overlay_needed(){
    // never displayed => needed
    if (!localStorage._overlay_last_){
        console.log("overlay needed (never displayed before)");
        return true;
    }

    // allotted time passed => needed
    elapsedMsec = Date.now() - localStorage._overlay_last_;
    if (elapsedMsec > TIME_ALLOWED_SEC * 1000){
        console.log("overlay needed (time elapsed)");
        return true;
    }

    return false;
}

function __main(){
    init_pause_video_timer();

    if (is_overlay_needed()){
        show_overlay();
    }else{
        start_overlay_timer(false);
    }
}


if (window._js_injected_){
    console.log("already injected");
}else{
    window._js_injected_ = true;
    console.log("loading injectionjs", window);

    document.addEventListener('DOMContentLoaded', function() {
        if (running_in_iframe()){
            console.log("in iframe...ignoring");
            return;
        }

        __main();
    }, false);
}
