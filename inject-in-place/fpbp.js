(function(){

    var overlay ='<style type="text/css">' +
'.overlay {'+
'    display: block;'+
'    height: 100%;'+
'    width: 0;'+
'    position: fixed;'+
'    z-index: 2147483647;'+
'    left: 0;'+
'    top: 0;'+
'    background-color: rgba(4,121,17,0.70);'+
'    overflow-x: hidden;'+
'/*    transition: 0.2s;*/'+
'}'+
''+
'#myNav p {'+
'    text-align: center;'+
'	font-size: 1em;'+
'    font-family: arial,sans-serif;'+
'    color: #eee;'+
'	vertical-align: baseline;'+
'	margin: 10px;'+
'/*	padding: 0; */'+
'/*	border: 0; */'+
'    line-height: 2'+
'    box-sizing: border-box;'+
''+
''+
'	padding: 0;'+
'	margin: 15px;'+
''+
'}'+
''+
'#myNav .overlay-content {'+
''+
'    position: relative;'+
'    top: 25%;'+
'    width: 100%;'+
''+
'    font-size: 36px;'+
'}'+
''+
'#myNav button {'+
'  position:relative;'+
'  width: auto;'+
'  display:inline-block;'+
'  font-size: 20px;'+
'  font-family: arial,sans-serif;'+
'  color:#ecf0f1;'+
'  text-decoration:none;'+
'  border-radius:5px;'+
'  border:solid 1px #f39c12;'+
'  background:#e67e22;'+
'  text-align:center;'+
'  padding:16px 18px 14px;'+
'  margin: 12px;'+
''+
'  -webkit-transition: all 0.1s;'+
'	-moz-transition: all 0.1s;'+
'	transition: all 0.1s;'+
''+
'  -webkit-box-shadow: 0px 6px 0px #d35400;'+
'  -moz-box-shadow: 0px 6px 0px #d35400;'+
'  box-shadow: 0px 6px 0px #d35400;'+
'}'+
''+
'#myNav button:active{'+
'    -webkit-box-shadow: 0px 2px 0px #d35400;'+
'    -moz-box-shadow: 0px 2px 0px #d35400;'+
'    box-shadow: 0px 2px 0px #d35400;'+
'    position:relative;'+
'    top:4px;'+
'}'+
''+
''+
''+
'</style>'+
''+
'<dialog id="myNav" class="overlay">'+
'  <div class="overlay-content">'+
'<p/>'+
'Access to this page is blocked.'+
'<p/>'+
'Click here to allow access for 1 minute'+
'<p/>'+
'<button id="myBtn">Allow</button>'+
'  </div>'+
'</dialog>';


    // by default prompt again after 1 mn
    var TIME_ALLOWED_SEC = 10;


    /* return true if the current window is in an iframe
     */
    function running_in_iframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    /**
     * return the time the user is allowed to brows in msec. This
     * information is passed as a dom attribute during script injection
     */
    function get_time_allowed_msec(){
        var fpscript = document.getElementById('__fp_bp_is');
        var interval_sec = TIME_ALLOWED_SEC;

        if (fpscript){
            if (fpscript.dataset.interval_sec){
                interval_sec = fpscript.dataset.interval_sec;
            }
        }
        console.log("interval_sec=", interval_sec);

        var interval_msec = (interval_sec * 1000);
        return interval_msec;
    }


    function on_overlay_timer_expired(){
        console.log("overlay timer expired");
        show_overlay();
    }


    function reset_overlay_timer(){
        localStorage.__fp_overlay_last_ = Date.now(); // msec
    }

    /*
     * if restart is true, reinitialize the timer
     */
    function start_overlay_timer(){
        var interval_msec = get_time_allowed_msec();

        var remainingMsec = interval_msec -
            (Date.now() - localStorage.__fp_overlay_last_);

        console.log("overlay timer started (msec): ", remainingMsec);
        setTimeout(on_overlay_timer_expired, remainingMsec);
    }


    function on_overlay_button_clicked(){
        hide_overlay();
        reset_overlay_timer();

        if (window.__fp_initial){
            window.location.reload();
            window.__fp_initial = false;
        }else{
            start_overlay_timer();
        }
    }

    function fragmentFromString(strHTML) {
        return document.createRange().createContextualFragment(strHTML);
    }
    /**
     * insert the html/css to display the overlay at the beginning of the
     * page
     */
    function insert_overlay(){
        // var temp = document.createElement('template');
        // temp.innerHTML = overlay;
        // var frag = temp.content;
        var frag = fragmentFromString(overlay);
        console.log("********", frag);
        document.body.insertBefore(frag, document.body.firstChild);

        var myBtn = document.getElementById("myBtn");
        myBtn.addEventListener("click", on_overlay_button_clicked);
    }

    /**
     * return true if the overlay is currently visible
     */
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
    }

    function hide_overlay(){
        var myNav = document.getElementById("myNav");
        if (myNav.close){
            myNav.close();
        }
        myNav.style.display="none";
    }

    /**
     * check if the overlay has been previously displayed and if the
     * allowed time is not elapsed
     */
    function is_overlay_needed(){
        // never displayed => needed
        if (!localStorage.__fp_overlay_last_){
            console.log("overlay needed (never displayed before)");
            return true;
        }

        // allotted time passed => needed
        var elapsed_msec = Date.now() - localStorage.__fp_overlay_last_;
        var interval_msec = get_time_allowed_msec();

        if (elapsed_msec > interval_msec){
            console.log("overlay needed (time elapsed)");
            return true;
        }

        return false;
    }

    function main(){
        if (running_in_iframe()){
            console.log("in iframe...ignoring");
            return;
        }

        if (window.__fp_js_injected_){
            console.log("already injected");
            return;
        }
        window.__fp_js_injected_ = true;

        if (!is_overlay_needed()){
            start_overlay_timer();
            return;
        }

        window.__fp_initial = true;

        var body = document.createElement("body");
        document.documentElement.appendChild(body);
        show_overlay();
        if (window.stop){
            window.stop();
        }else{
            // MSIE
            document.execCommand("Stop");
        }
    }

    main();

})();
