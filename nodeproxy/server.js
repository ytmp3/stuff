const express = require('express');
const app = express();
const port = 3000;

//app.get('/', (req, res) => res.send('Hello World!'));
app.use(express.static(__dirname + '/public', {
    setHeaders: function(res, path) {
        // res.set({
        //     "Content-Security-Policy":`script-src 'self' https://code.jquery.com 'unsafe-inline';`
        // });
  }
}));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
