console.log("in local.js...", $);

$("body").append("jquery insert 1");


$(function() {
    console.log("jquery ready");
    $("body").append("jquery on load");
});
