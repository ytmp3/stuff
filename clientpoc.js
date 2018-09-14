overlay = `
<style type="text/css">
.overlay {
    height: 100%;
    width: 0;
    position: fixed;
    z-index: 1;
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


function insert_overlay(){
    var temp = document.createElement('template');
    temp.innerHTML = overlay;
    var frag = temp.content;
    document.body.appendChild(frag);
}

function show_overlay(){
    document.getElementById("myNav").style.width = "100%";
}

function hide_overlay(){
    document.getElementById("myNav").style.width = "0%";
}

if (! localStorage._overlay_shown_){
    insert_overlay();
    show_overlay();
    document.getElementById("myBtn").addEventListener("click", function(){
        hide_overlay();
        localStorage._overlay_shown_ = true;
    });
}
