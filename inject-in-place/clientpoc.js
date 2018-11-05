(function(){

    var overlay = `
<style type="text/css">
.overlay {
    display: block;
    height: 100%;
    width: 0;
    position: fixed;
    z-index: 2147483647;
    left: 0;
    top: 0;
    background-color: rgba(4,121,17,0.99);
    overflow-x: hidden;
/*    transition: 0.2s;*/
}

#myNav p {
    text-align: center;
	font-size: 1em;
    font-family: arial,sans-serif;
    color: #eee;
	vertical-align: baseline;
	margin: 10px;
/*	padding: 0; */
/*	border: 0; */
    line-height: 2
    box-sizing: border-box;


	padding: 0;
	margin: 15px;

}

#myNav .overlay-content {

    position: relative;
    top: 25%;
    width: 100%;

    font-size: 36px;
}

#myNav button {
  position:relative;
  width: auto;
  display:inline-block;
  font-size: 20px;
  font-family: arial,sans-serif;
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

#myNav button:active{
    -webkit-box-shadow: 0px 2px 0px #d35400;
    -moz-box-shadow: 0px 2px 0px #d35400;
    box-shadow: 0px 2px 0px #d35400;
    position:relative;
    top:4px;
}



</style>

<iframe id="receiver" src="https://www.forcepoint.com/blockpage_poc/cross-domain-store.html" width="0" height="0"></iframe>

<dialog id="myNav" class="overlay">
  <div class="overlay-content">
<p/>
Access to this page is blocked.
<p/>
Click here to allow access for 1 minute
<p/>
<button id="myBtn">Allow</button>
  </div>
</dialog>

`;

// by default prompt again after 10 mn
var TIME_ALLOWED_MN = 10;



function pause_media(type){
    var media = document.querySelectorAll(type);
    if (media){
        // console.log("pause_media type: '%s'=> found: %d", type,  media.length);
        for (let v of media){
             v.pause();
        }
    }
}

function play_media(type){
    for (let v of document.getElementsByTagName(type)){
        v.play();
    }
}


function start_video_timer()
{
    let timer = setInterval(()=>{
        if (is_overlay_visible()){
            // console.log("overlay visible: id=", timer);
            pause_media('audio');
            pause_media('video');
        }else{
            console.log("video_timer stopped: id=", timer);
            clearInterval(timer);
        }
    }, 500);
    console.log("video_timer started: id=", timer);

}


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


function get_time_allowed_msec(){
    const fpscript = document.getElementById('__fp_bp_is');

    const interval_mn = fpscript.dataset.interval_mn;
    if (!interval_mn){
        interval_mn = TIME_ALLOWED_MN;
    }
    console.log("interval_mn=", interval_mn);

    const interval_msec = (interval_mn * 1000 * 60);
    return interval_msec;
}


function start_overlay_timer(restart=false){
    if (!localStorage._overlay_last_ || restart){
        localStorage._overlay_last_ = Date.now(); // msec
    }
    const interval_msec = get_time_allowed_msec();

    var remainingMsec = interval_msec -
        (Date.now() - localStorage._overlay_last_);

    console.log("overlay timer started (msec): ", remainingMsec);
    setTimeout(on_overlay_timer_expired, remainingMsec);
}


function on_overlay_button_clicked(){
    hide_overlay();
    start_overlay_timer(true);

    // var receiver = document.getElementById('receiver').contentWindow;
    // receiver.postMessage({msg:'cookie data!'}, 'https://www.forcepoint.com');
    // window.addEventListener('message', (e)=>{
    //     console.log("parent got message: ", e);
    // });
}

function insert_overlay(){
    var temp = document.createElement('template');
    temp.innerHTML = overlay;
    var frag = temp.content;
    document.body.insertBefore(frag, document.body.firstChild);

    var myBtn = document.getElementById("myBtn");
    myBtn.addEventListener("click", on_overlay_button_clicked);
}


function is_overlay_visible(){
    var myNav = document.getElementById("myNav");
    if (!myNav){
        return false;
    }
    var w = myNav.style.display;
    return w=="none"? false: true;
}

function show_overlay(){
    var myNav = document.getElementById("myNav");
    if (!myNav){
        insert_overlay();
        myNav = document.getElementById("myNav");
    }
    myNav.style.width = "100%";
    myNav.style.display="block";

    if (myNav.showModal){
        myNav.showModal();
    }
    start_video_timer();
}

function hide_overlay(){
    var myNav = document.getElementById("myNav");
    if (myNav.close){
        myNav.close();
    }
    myNav.style.display="none";
    // myNav.style.width = "0%";
}

function is_overlay_needed(){
    // never displayed => needed
    if (!localStorage._overlay_last_){
        console.log("overlay needed (never displayed before)");
        return true;
    }

    // allotted time passed => needed
    const elapsed_msec = Date.now() - localStorage._overlay_last_;
    const interval_msec = get_time_allowed_msec();

    if (elapsed_msec > interval_msec){
        console.log("overlay needed (time elapsed)");
        return true;
    }

    return false;
}

function __main(){

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

})();
