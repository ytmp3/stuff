var __fp_pb_module = (function(){

    var overlay_html = '<style type="text/css">' +
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
'    background-color: rgba(30,30,30,0.90);'+
'}'+
''+
'#__fp_overlay .__fp_outer {' +
'  display: table;' +
'  position: absolute;overflow: none;' +
'  height: 100%;' +
'  width: 100%;' +
'}' +
'' +
'#__fp_overlay .__fp_middle {' +
'  display: table-cell;' +
'  vertical-align: middle;' +
'}' +
'' +
'#__fp_overlay .__fp_inner {' +
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
'  <div class="__fp_outer">' +
'    <div class="__fp_middle">' +
'      <div class="__fp_inner">' +
'        <iframe  id="__fp_overlay_iframe" src="javascript:null"></iframe>'+
'      </div>' +
'    </div>' +
'  </div>' +
'</dialog>';


    var SHIF ='<iframe  id="__fp_shif" src="https://www.forcepoint.com/blockpage_poc/fpbpstore-src.html"></iframe>';

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


    // by default prompt again after n seconds
    var TIME_ALLOWED_SEC = 60;

    var EXTRA_PARAM_NAME="x-fp-bp-xhr";


    var globals = {
        XMLHttpRequest_open:XMLHttpRequest.prototype.open,
        fetch:window.fetch

    };

    /**
     * mini template engine. expand variables with 'handlebar'
     * syntax. eg {{myvar}}
     *
     * from https://gist.github.com/3277292
     *
     * @param template html string with template variables
     * @param context dict containing the variables to replace
     *
     * @return expanded template string
     */
    function render_template(template, context){
        return template.replace(/{{\s*([a-zA-z0-9_.]+)\s*}}/gm, function(m, key){
            var value;
            var source = context;
            var subkeys = key.split('.');

            for (var i in subkeys) {
                value = source.hasOwnProperty(subkeys[i]) ?
                    source[subkeys[i]] : '';
                source = value;
            }
            return value;
        });
    }

    /*
     * return true if the current window is in an iframe
     */
    function running_in_iframe() {
        try {
            return window.self !== window.top;
        } catch (e){
            return true;
        }
        return false;
    }

    /* creates a document fragment from a string
     *
     * @return instance of DocumentFragment
     */
    function fragmentFromString(strHTML){
        return document.createRange().createContextualFragment(strHTML);
    }

    /**
     * find all the media element on the page and pause them
     *
     * @param type - "audio" or "video"
     */
    function pause_media(type){
        console.log("pause_media %s", type);
        var media = document.querySelectorAll(type);
        if (!media){return;}
        for (var i=0;i<media.length; i++){
            var v = media[i];
            if (v && v.pause){
                v.pause();
            }
        }
    }

    /**
     * return 'data' attribute of the injected 'script' element or
     * null if no data attribute found
     *
     * e.g. to obtain "data-category":
     *
     * <script data-category="social"...
     * data_content = get_data("category")
     *
     * list of data attributes:
     * - content: user-defined html document for the popup
     * - category: identify the matched category
     * - interval_sec: interval in seconds before showing the popup again

     * - shared_domain_url: url to serve the hidden iframe used to
         have a cross-domain browser storage.
     */
    function get_data(key){
        var fpscript = document.getElementById('__fp_bp_is');
        if (!fpscript){return null;}
        return fpscript.dataset[key];
    }

    function get_category(){
        var categ = get_data("category") || "default_category";
        return categ;
    }

    /**
     * expand the variables in the template using the 'data' attribute
     * of the injected 'script' element.
     *
     * Syntax is similar to handlebar, e.g.
     * {{myvar}}
     *
     * @param template - string containing the template (obtained from
     * "data-content")
     *
     * @return string containing the expanded template
     */
    function render_popup_template(template){
        var fpscript = document.getElementById('__fp_bp_is');
        if (!fpscript){return template;}

        var res = render_template(template, fpscript.dataset);
        return res;
    }

    /**
     * get the html template for the popup. If the injected 'script'
     * element has a "data-content" attribute, it must contain a
     * base64 string containing an html document.
     * Else, the DEFAULT_OVERLAY_CONTENT is used.
     */
    function get_overlay_content(){
        var overlay_content = get_data('content');
        if (overlay_content){
            return atob(overlay_content);
        }
        return DEFAULT_OVERLAY_CONTENT;
    }

    /**
     * return the time the user is allowed to browse in milliseconds.
     *
     * This information is passed as a dom attribute during script
     * injection as "data-interval_sec"
     */
    function get_time_allowed_msec(){
        var fpscript = document.getElementById('__fp_bp_is');
        var interval_sec = TIME_ALLOWED_SEC;

        if (fpscript){
            if (fpscript.dataset.interval_sec){
                interval_sec = fpscript.dataset.interval_sec;
            }
        }
        console.log("allowed interval_sec=", interval_sec);

        var interval_msec = (interval_sec * 1000);
        return interval_msec;
    }

    /**
     * event handler called when timer expired. It shows the popup
     * again and stops the video and audio on the page. The timer is
     * not restarted immediately. It will be restarted when the user
     * clicks on the consent button.
     */
    function on_overlay_timer_expired(){
        console.log("overlay timer expired");
        show_overlay();
    }

    function get_storage_value(category, key){
        var category_name = get_data("category");
        var shared_domain_url = get_data("shared_domain_url");
        if (category_name==null || shared_domain_url==null ){

        }
    }


    /*
     * start the overlay timer, based on the time saved in local
     * storage
     */
    function start_overlay_timer(overlay_timer_msec){
        var interval_msec = get_time_allowed_msec();

        var remainingMsec = interval_msec - (Date.now() - overlay_timer_msec);
        console.log("overlay timer started (msec): ", remainingMsec);
        setTimeout(on_overlay_timer_expired, remainingMsec);
    }


    /**
     * event handler called when the user does not wish to continue
     * and presses the 'back' button of the popup. We simply go back
     * to the page we came from, if any.
     */
    function on_overlay_button_back(){
        window.history.back();
    }

    /**
     * event handler called when the user wishes to continue.  this
     * function hides the overlay and restart the timer.
     */
    function on_overlay_button_clicked(){
        hide_overlay();

        var now_msec = Date.now();
        set_overlay_timer(now_msec);

        if (window.__fp_initial){
            window.location.reload();
            window.__fp_initial = false;
        }else{
            start_overlay_timer(now_msec);
        }
    }


    /**
     * see insert_overlay()
     * @return true on success
     */
    function _do_insert_overlay(){
        var content_doc = null;
        var overlay_iframe = null;
        var overlay_frag = fragmentFromString(overlay_html);

        var insertedNode = document.body.insertBefore(overlay_frag,
                                                      document.body.firstChild);
        overlay_iframe = document.getElementById("__fp_overlay_iframe");

        if (!overlay_iframe){
            console.error("Error in insert_overlay: "+
                          "unable to access overlay_iframe");
            return false;
        }

        if (overlay_iframe.contentDocument){
            content_doc = overlay_iframe.contentDocument;
        }else if (overlay_iframe.contentWindow){
            content_doc = overlay_iframe.contentWindow.document;
        }

        if (!content_doc){
            console.error("Error in insert_overlay: "+
                          "unable to access contentDocument iframe");
            return false;
        }

        var overlay_content_template = get_overlay_content();
        var overlay_content =
            render_popup_template(overlay_content_template);
        if (!overlay_content){
            console.error("Error in insert_overlay: "+
                          "unable to get overlay content");
            return false;
        }

        content_doc.open();
        content_doc.write(overlay_content);
        content_doc.close();

        var overlay_allow_button =
            content_doc.getElementById("__fp_overlay_allow");

        if (overlay_allow_button==null){
            console.error("Unable to find '__fp_overlay_allow id' button in html");
            return false;
        }
        overlay_allow_button.addEventListener("click", on_overlay_button_clicked);

        var overlay_back_button =
            content_doc.getElementById("__fp_overlay_back");

        // allow button optional
        if (overlay_allow_button){
            overlay_back_button.addEventListener("click", on_overlay_button_back);
        }
        return true;
    }

    function get_overlay(){
        var overlay = document.getElementById("__fp_overlay");
        return overlay;
    }

    function remove_overlay(){
        var overlay = get_overlay();
        overlay.parentNode.removeChild(overlay);
    }

    /**
     * insert the html/css to display the overlay at the beginning of
     * the page. The html that is inserted remains in place even after
     * the user clicks on the consent button, in case we need to show
     * the popup again once the timer is expired.
     *
     * this function uses an iframe to isolate the css of the overlay
     * popup from the css of the main page.

     * @return __dp_overlay element on success or null
     */
    function insert_overlay(){
        if (!_do_insert_overlay()){
            remove_overlay();
            return null;
        }

        return get_overlay();
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

    /**
     * shows the overlay and pause the video and audio currently
     * playing on the page.
     */
    function show_overlay(){
        var overlay = get_overlay();
        if (!overlay){
            overlay = insert_overlay();
        }
        if (!overlay){
            console.error("Unable to get overlay. blockpage feature disabled");
            return;
        }

        overlay.style.width = "100%";
        overlay.style.display="block";

        try{
            pause_media("audio");
            pause_media("video");
        }catch(e){
            console.log("show_overlay: pause_media error (ignored)", e);
        }

        if (!overlay.open && overlay.showModal){
            overlay.showModal();
        }
    }

    function hide_overlay(){
        var overlay = get_overlay();
        if (!overlay){
            return;
        }

        if (overlay.close){
            overlay.close();
        }
        overlay.style.display="none";
    }

    /**
     * check if the overlay has been previously displayed and if the
     * allowed time is not elapsed
     */
    function is_overlay_needed(overlay_timer_msec){
        // never displayed => needed
        if (!overlay_timer_msec){
            console.log("overlay needed (never displayed before)");
            return true;
        }

        // allotted time passed => needed
        var elapsed_msec = Date.now() - overlay_timer_msec;
        var interval_msec = get_time_allowed_msec();

        if (elapsed_msec > interval_msec){
            console.log("overlay needed (time elapsed)");
            return true;
        }

        return false;
    }

    function get_shared_domain_iframe(url){
        var shared_domain_iframe = document.getElementById("__fp_shif");
        if (!shared_domain_iframe){
            shared_domain_iframe = document.createElement("iframe");
            shared_domain_iframe.setAttribute("src", url);
            shared_domain_iframe.width = "10px";
            shared_domain_iframe.height =  "10px";
            shared_domain_iframe.id = "__fp_shif";
            document.documentElement.appendChild(shared_domain_iframe);

        }
        return shared_domain_iframe;
    }

    function set_overlay_timer(value_msec){
        var category_name = get_category();
        var shared_domain_url = get_data("shared_domain_url");
        // var shared_domain_url=null;

        if (shared_domain_url){
            var shared_domain_iframe = get_shared_domain_iframe(shared_domain_url);
            var iframe_window = shared_domain_iframe.contentWindow;

            iframe_window.postMessage(
                {op:'set_overlay_timer', category: category_name,
                 value_msec: value_msec}, '*');

        }else{
            var timer_name = "__fp_" + category_name + "_timer_msec";
            localStorage[timer_name] = value_msec;
        }
    }

    function get_overlay_timer(handle_response){
        var category_name = get_category();

        var shared_domain_url = get_data("shared_domain_url");
        // var shared_domain_url = null;

        if (shared_domain_url){
            var shared_domain_iframe = get_shared_domain_iframe(shared_domain_url);
            var iframe_window = shared_domain_iframe.contentWindow;

            iframe_window.postMessage(
                {op:'get_overlay_timer', category: category_name}, '*');
            window.addEventListener('message', function(e){
                if (e.data.op && e.data.op === 'get_overlay_timer_resp'){
                    console.log("parent receives get_overlay_timer_resp: ", e);
                    var overlay_timer_msec = e.data.value_msec;
                    handle_response(overlay_timer_msec);
                }
            });

        }else{
            var timer_name = "__fp_" + category_name + "_timer_msec";
            var overlay_timer_msec = localStorage[timer_name];
            handle_response(overlay_timer_msec);
        }
    }


    function _add_url_param(url, param){
        if (url.indexOf("?") != -1){
            url += "&" + param;
        }else{
            url += "?" + param;
        }
        return url;
    }



    // signature:
    //  - mandatory: method, url
    //  - optional: async, user, password
    function _XMLHttpRequest_open(){
        var method = arguments[0];
        var url = arguments[1];
        if (method.toLowerCase() === 'get'){
            arguments[1] = _add_url_param(url, EXTRA_PARAM_NAME);

        }
        console.log("get hook: ", arguments);
        return globals.XMLHttpRequest_open.apply(this, arguments);
    }

    // signature:
    // - mandatory: input (either a url or an instance of Request)
    // - optional: init (object)
    function _fetch(){
        var url;
        var init;

        var input = arguments[0];
        if (typeof(input) === 'String'){
            var mustAddParam = true;

            if (arguments.length === 2){
                init = arguments[1];
                mustAddParam =
                    !("method" in init) ||
                    (init.method.toLowerCase() === 'get');
            }

            if (mustAddParam){
                url = _add_url_param(input, EXTRA_PARAM_NAME);
                arguments[0] = url;
            }

        }else if (input.method.toLowerCase() === 'get'){ // input type
            // is 'Request'
            init = {};
            for (var k in input){
                if (typeof(input[k]) !== 'function' && k != 'url'){
                    init[k] = input[k];
                }
            }
            url = _add_url_param(input.url, EXTRA_PARAM_NAME);
            arguments[0] = new Request(url, init);
        }

        console.log("fetch hook: ", arguments);
        return globals.fetch.apply(this, arguments);
    }



    /*
       this function installs hooks to intercept XHR/fetch and add a
       custom url parameter to inform the server that no injection
       should be made on this request.

       todo:
       is it possible to hook XMLHttpRequest and fetch for service
       workers and web workers ?

       the first idea was to add a custom header instead of a custom
       url parameter, but it does not work with cors/preflight
       request.
     */
    function installHooks(){
        XMLHttpRequest.prototype.open = _XMLHttpRequest_open;

        if (window.fetch){
            window.fetch = _fetch;
        }
    }


    function check_timer_show_overlay(){
        console.log("in check_timer_show_overlay");
        get_overlay_timer(function(overlay_timer_msec){
            var has_shared_domain_url = get_data("shared_domain_url");
            if (is_overlay_needed(overlay_timer_msec)){
                window.__fp_initial = true;

                var body = document.createElement("body");
                document.documentElement.appendChild(body);
                show_overlay();

                if (! has_shared_domain_url){
                    if (window.stop){
                        window.stop();
                    }else /*MSIE*/{
                        document.execCommand("Stop");
                    }
                }

            }else{
                start_overlay_timer(overlay_timer_msec);
            }
        });
    }

    /**
     * entry point of this module. Note that the code is executed
     * immediately.
     *
     * We do not wait for the page to load, so we are
     * able to stop the loading process to display the overlay, which
     * limits the side-effects of the page loading in the background
     * (such as audio starting to play, notifications popup appearing,
     * RGPD consent popup and so on...)
     */
    function main(){
        installHooks();

        if (running_in_iframe()){
            console.log("in iframe...ignoring");
            return;
        }

        if (window.__fp_js_injected_){
            console.log("already injected");
            return;
        }
        window.__fp_js_injected_ = true;

        var shared_domain_url = get_data("shared_domain_url");
        if (shared_domain_url){
            var shared_domain_iframe = get_shared_domain_iframe(shared_domain_url);
            shared_domain_iframe.addEventListener("load", check_timer_show_overlay);
        }else{
            check_timer_show_overlay();
        }
    }

    return {
        main: main,
        _fetch: _fetch,
        globals: globals
    };

})();

if (document.getElementById('__fp_bp_is')){
    __fp_pb_module.main();
}
