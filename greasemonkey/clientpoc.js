overlay = `
<style type="text/css">
.overlay {
    height: 100%;
    width: 0;
    position: fixed;
    z-index: 100000000;
    left: 0;
    top: 0;
    background-color: rgb(0,0,0);
    background-color: rgba(0,0,0, 0.9);
    overflow-x: hidden;
    transition: 0.2s;
}

.overlay-content {
    position: relative;
    top: 25%;
    width: 100%;
    text-align: center;
    margin-top: 30px;

    font-size: 36px;
    color: #818181;
}

</style>

<div id="myNav" class="overlay">
  <div class="overlay-content">
Access to this page is blocked.
<p/>
Click here to allow access for 1 minute
<p/>

<button id="myBtn">Allow</button>
  </div>
</div>
`


var TIME_ALLOWED_SEC = 60;


function pause_or_play_all_videos(pause){

    for (v of document.getElementsByTagName('video')){
        if (pause){
            v.pause();
        }else{
            v.play();
        }
    }
    for (v of document.getElementsByTagName('audio')){
        if (pause){
            v.pause();
        }else{
            v.play();
        }
    }
}



function init_pause_video_timer(){
    localStorage.pause_video_timer = JSON.stringify([]);
}

function start_pause_video_timer()
{
    // if (localStorage.pause_video_timer){
    //     console.log("already have pause_video_timer: ",
    //                 localStorage.pause_video_timer);
    //     return;
    // }

    if (!localStorage.pause_video_timer){
        init_pause_video_timer();
    }
    let timers = JSON.parse(localStorage.pause_video_timer);

    let timer = setInterval(()=>{
        pause_or_play_all_videos(true);
    }, 500);
    timers.push(timer);
    localStorage.pause_video_timer = JSON.stringify(timers);
    console.log("starting pause_video_timer: ", timer);

}

function stop_pause_video_timer()
{
    if (localStorage.pause_video_timer){
        let timers = JSON.parse(localStorage.pause_video_timer);
        for (t of timers){
            console.log("stopping pause_video_timer: ", t);
            clearInterval(t);
        }
        delete localStorage.pause_video_timer;
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

    var myBtn = document.getElementById("myBtn");
    myBtn.addEventListener("click", on_overlay_button_clicked);
}


function show_overlay(){
    var myNav = document.getElementById("myNav");
    if (!myNav){
        insert_overlay();
        myNav = document.getElementById("myNav");
    }
    myNav.style.width = "100%";
    start_pause_video_timer();
}

function hide_overlay(){
    var myNav = document.getElementById("myNav");
    myNav.style.width = "0%";
    stop_pause_video_timer();
    pause_or_play_all_videos(false);

}

function is_overlay_needed(){
    // never displayed => needed
    if (!localStorage._overlay_last_){
        console.log("overlay needed (never displayed)");
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


if (! running_in_iframe()){
    setTimeout(__main, 500);
}else{
    console.log("in iframe...ignoring");
    // start_pause_video_timer();
}
