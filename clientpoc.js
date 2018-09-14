// var link = document.createElement("link");
// link.href = "http://localhost:1234/mystyle.css";
// link.type = "text/css";
// link.rel = "stylesheet";
// document.getElementsByTagName("head")[0].appendChild(link);


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
    transition: 0.5s;
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

<button>Allow</button>
  </div>
</div>
`

var temp = document.createElement('template');
temp.innerHTML = overlay;
var frag = temp.content;

document.body.appendChild(frag);
document.getElementById("myNav").style.width = "100%";
