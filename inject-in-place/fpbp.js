(function(){

    var overlay = '<style type="text/css">' +
'#__fp_overlay * {'+
'    box-sizing: border-box;'+
'}'+
'#__fp_overlay {'+
'    display: block;'+
'    height: 100%;'+
'    width: 100%;'+
'    position: fixed;'+
'    z-index: 2147483647;'+
'    left: 0;'+
'    top: 0;'+
'    padding: 20px;'+
'    margin: auto;'+
'    border: 0;'+
'    background-color: rgba(4,121,17,0.90);'+
'}'+
''+
'</style>'+
''+
'<dialog id="__fp_overlay" >'+
//'    <iframe id="__fp_overlay_iframe" src="#" style="width:70%;height:50%; padding: 20px; margin: auto;border: 0; "></iframe>'+
'    <iframe id="__fp_overlay_iframe" src="javascript:" style=""></iframe>'+
'</dialog>';


    var overlay_content = `
<html>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <head>
    <style>
    body {
    background-color: #fff;
    }
    </style>
  </head>
  <body>
    <div>
       Access to this page is blocked.
       Click here to allow access for X minutes
    </div>
    <button id="__fp_overlay_allow">Allow</button>
  </body>
</html>
`;


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
        console.log("=> interval_sec=", interval_sec);

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
        var overlay_frag = fragmentFromString(overlay);
        document.body.insertBefore(overlay_frag, document.body.firstChild);

        var overlay_iframe = document.getElementById("__fp_overlay_iframe");
        var overlay_content_frag = fragmentFromString(overlay_content);
        overlay_iframe.contentDocument.body.appendChild(overlay_content_frag);


        var overlay_allow_button = overlay_iframe.contentDocument.getElementById("__fp_overlay_allow");
        overlay_allow_button.addEventListener("click", on_overlay_button_clicked);
    }

    /**
     * return true if the overlay is currently visible
     */
    function is_overlay_visible(){
        var overlay = document.getElementById("__fp_overlay");
        if (!overlay){
            return false;
        }
        var w = overlay.style.display;
        return w=="none"? false: true;
    }

    function show_overlay(){
        var overlay = document.getElementById("__fp_overlay");
        if (!overlay){
            insert_overlay();
            overlay = document.getElementById("__fp_overlay");
        }
        overlay.style.width = "100%";
        overlay.style.display="block";

        if (overlay.showModal){
            overlay.showModal();
        }
    }

    function hide_overlay(){
        var overlay = document.getElementById("__fp_overlay");
        if (overlay.close){
            overlay.close();
        }
        overlay.style.display="none";
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

        var x = document.getElementById("__fp_bp_is");
        console.log(x);
        console.log(x.attributes);
        console.log(x.dataset);
        console.log(x.dataset.interval_sec);
        console.log(x.dataset["interval_sec"]);
//debugger;
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
