const express = require('express');
const bodyParser = require('body-parser');
const aws = require('aws-sdk');

const app = express();

app.use(
  bodyParser.json({
    extended: true,
  })
);

const port = 8080;

require('./app/routes')(app, {});

app.listen(port, () => {
  console.log("Running on ", port);
});
