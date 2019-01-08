const express = require('express');
const app = express();
const port = 3000;

//app.get('/', (req, res) => res.send('Hello World!'));
app.use(express.static(__dirname + '/public', {
    setHeaders: function(res, path) {
        res.set({
            // "Content-Security-Policy":`script-src 'self' https://code.jquery.com 'unsafe-inline';`


            // BOTH script-src and frame-src
            // -------------------------------
            // "Content-Security-Policy":`script-src 'self' https://code.jquery.com; frame-src 'self'`

            // ONLY script-src
            // -------------------------------
            // "Content-Security-Policy":`script-src 'self' https://code.jquery.com`

            // ONLY frame-src
            // -------------------------------
            // "Content-Security-Policy":`frame-src 'self'`

            // ONLY default-src
            // -------------------------------
            "Content-Security-Policy":`style-src 'unsafe-inline'; default-src 'self' https://code.jquery.com`

            // BOTH script-src and default-src
            // -------------------------------
            // "Content-Security-Policy":`script-src 'self' https://code.jquery.com; default-src 'self'`


        });
  }
}));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
