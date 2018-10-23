var overlay = `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.4.10/dialog-polyfill.js" integrity="sha256-MzKeKXV3W7bf3Uu0xLNN/SiVj3OBfBUzD3VmMb/yyCQ=" crossorigin="anonymous"></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/dialog-polyfill/0.4.10/dialog-polyfill.css" integrity="sha256-hT0ET4tfm+7MyjeBepBgV2N5tOmsAVKcTWhH82jvoaA=" crossorigin="anonymous" />
    <style>





dialog#myNav > div {
	font-size: 20px;
    font-family: arial,sans-serif;
    color: #444;
	vertical-align: baseline;
	margin: 0;
	padding: 0;
	border: 0;
    box-sizing: border-box;
}


dialog#myNav button {
  position:relative;
  width: auto;
  display:inline-block;
  color:#ecf0f1;
  text-decoration:none;
  border-radius:5px;
  border:solid 1px #f39c12;
  background:#e67e22;
  text-align:center;
  padding:16px 18px 14px;
  margin: 12px;

  -webkit-transition: all 0.1s;
	-moz-transition: all 0.1s;
	transition: all 0.1s;

  -webkit-box-shadow: 0px 6px 0px #d35400;
  -moz-box-shadow: 0px 6px 0px #d35400;
  box-shadow: 0px 6px 0px #d35400;
}

dialog#myNav button:active{
    -webkit-box-shadow: 0px 2px 0px #d35400;
    -moz-box-shadow: 0px 2px 0px #d35400;
    box-shadow: 0px 2px 0px #d35400;
    position:relative;
    top:4px;
}

dialog#myNav  {
      border: 0;
      padding: 20px;
      }

dialog#myNav  + .backdrop {
      background-color: rgba(4,121,17,1);
      }

dialog::backdrop { /* native */
      background-color: rgba(4,121,17,1);
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


function _save_pause_video_timer(id){
    console.log("save pause_video_timer: id=", id, ": old value=",
                window._pause_video_timer_id);
    window._pause_video_timer_id = id;
}

function _init_pause_video_timer(){
    _save_pause_video_timer(-1);
}

function _read_pause_video_timer(){
    if ('_save_pause_video_timer' in window){
        console.log("read pause_video_timer: id=", window._pause_video_timer_id);
        return window._pause_video_timer_id;
    }else{
        _init_pause_video_timer();
    }
}



function start_pause_video_timer()
{
    if (!localStorage._pause_video_timer_){
        _init_pause_video_timer();
        pause_iframes();
    }

    let old_timer = _read_pause_video_timer();
    if (old_timer != -1){
        console.log("already have a timer");
        stop_pause_video_timer();
    }

    let timer = setInterval(()=>{
        pause_media('audio');
        pause_media('video');
    }, 500);
    console.log("starting pause_video_timer: id=", timer);
    _save_pause_video_timer(timer);

}

function stop_pause_video_timer()
{
    let timer = _read_pause_video_timer();
    if (timer != -1){
        console.log("stopping pause_video_timer: id=", timer);
        clearInterval(timer);
        _save_pause_video_timer(-1);
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
    _init_pause_video_timer();
    pause_iframes();

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
