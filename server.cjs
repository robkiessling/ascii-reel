const path = require('path');
const express = require('express');
const PORT = process.env.PORT || 8081;

express()
    .use(express.static(path.join(__dirname, 'dist')))
    .set('port', PORT)
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));