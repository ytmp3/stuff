overlay = `
<style type="text/css">
.overlay {
    height: 100%;
    width: 0;
    position: fixed;
    z-index: 10000000;
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
Click here to allow access for 10 minutes
<p/>

<button id="myBtn">Allow</button>
  </div>
</div>
`


var TIME_ALLOWED_SEC = 60;



function on_overlay_timer_expired(){
    console.log("timer expired");
    show_overlay();
}

function start_overlay_timer(restart=false){
    if (!localStorage._overlay_last_ || restart){
        localStorage._overlay_last_ = Date.now(); // msec
    }

    remainingMsec = TIME_ALLOWED_SEC * 1000 -
        (Date.now() - localStorage._overlay_last_);

    console.log("timer started: ", remainingMsec);
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
}

function hide_overlay(){
    var myNav = document.getElementById("myNav");
    myNav.style.width = "0%";
}

function is_overlay_needed(){
    // never displayed => needed
    if (!localStorage._overlay_last_){
        return true;
    }

    // allotted time passed => needed
    elapsedMsec = Date.now() - localStorage._overlay_last_;
    if (elapsedMsec > TIME_ALLOWED_SEC * 1000){
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


setTimeout(__main, 500);
