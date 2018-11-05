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
'    padding: 0;'+
'    margin: 0;'+
'    border: 0;'+
'    background-color: rgba(80,0,0,0.90);'+
'}'+
''+
'#__fp_overlay .outer {' +
'  display: table;' +
'  position: absolute;overflow: none;' +
'  height: 100%;' +
'  width: 100%;' +
'}' +
'' +
'#__fp_overlay .middle {' +
'  display: table-cell;' +
'  vertical-align: middle;' +
'}' +
'' +
'#__fp_overlay .inner {' +
'  margin-left: auto;' +
'  margin-right: auto;' +
'  padding: 10px;' +
'  width: 600px;' +
'}' +
'#__fp_overlay_iframe {' +
'    width: 100%;' +
'    background-color: #fff;' +
'    border: 0;' +
'}' +
'' +
'</style>'+
''+
'<dialog id="__fp_overlay" >'+
'<div class="outer">' +
'  <div class="middle">' +
'  <div class="inner">' +
'    <iframe  id="__fp_overlay_iframe" src="javascript:null"></iframe>'+
'  </div>' +
'  </div>' +
'</div>' +
'</dialog>';



    var DEFAULT_OVERLAY_CONTENT =
'<html>' +
'  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
'  <body>' +
'    <div>' +
'       Access to this page is blocked (corporate policy)' +
'    </div>' +
'    <button id="__fp_overlay_allow">Access anyway</button>' +
'    <button id="__fp_overlay_back">Go back</button>' +
'  </body>' +
'</html>'
;


    // by default prompt again after 1 mn
    var TIME_ALLOWED_SEC = 10;

    // from https://gist.github.com/3277292
    function render_template(template, context){
        return template.replace(/{{\s*([a-zA-z0-9_.]+)\s*}}/gm, function(m, key){
            var value;
            var source = context;
            var subkeys = key.split('.');

            for (var i in subkeys) {
                value = source.hasOwnProperty(subkeys[i]) ? source[subkeys[i]] : '';
                source = value;
            }
            return value;
        });
    }

    /* return true if the current window is in an iframe
     */
    function running_in_iframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    function pause_media(type){
        var media = document.querySelectorAll(type);
        if (!media){return;}
        for (var i=0;i<media.length; i++){
            var v = media[i];
            if (v.pause){
                v.pause();
            }
        }
    }


    function get_data(key){
        var fpscript = document.getElementById('__fp_bp_is');
        if (!fpscript){return null;}

        return fpscript.dataset[key];
    }


    function expand_template_with_dataset(template){
        var fpscript = document.getElementById('__fp_bp_is');
        if (!fpscript){return template;}

        var res = render_template(template, fpscript.dataset);
        return res;
    }

    function get_overlay_content(){
        var overlay_content = get_data('content');
        if (overlay_content){
            return atob(overlay_content);
        }
        return DEFAULT_OVERLAY_CONTENT;
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


    function on_overlay_button_back(){
        window.history.back();
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
        var overlay_frag = fragmentFromString(overlay);
        document.body.insertBefore(overlay_frag, document.body.firstChild);

        var overlay_iframe = document.getElementById("__fp_overlay_iframe");

        var content_doc = null;

        if (overlay_iframe.contentDocument){
            content_doc = overlay_iframe.contentDocument;
        }else if (overlay_iframe.contentWindow){
            content_doc = overlay_iframe.contentWindow.document;
        }
        else{
            console.log("Error in insert_overlay: "+
                        "unable to access contentDocument iframe");
            return;
        }

        var overlay_content_template = get_overlay_content();
        var overlay_content =
            expand_template_with_dataset(overlay_content_template);

        content_doc.open();
        content_doc.write(overlay_content);
        content_doc.close();

        var overlay_allow_button =
            content_doc.getElementById("__fp_overlay_allow");
        overlay_allow_button.addEventListener("click", on_overlay_button_clicked);
        var overlay_back_button =
            content_doc.getElementById("__fp_overlay_back");
        overlay_back_button.addEventListener("click", on_overlay_button_back);
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
        try{
            pause_media("audio");
            pause_media("video");
        }catch(e){
            console.log("show_overlay: pause_media error (ignored)", e);
        }

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
