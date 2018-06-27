const expect = require('chai').expect;
const routes = require('../../app/routes');
const request = require('request');
const baseUrl = 'http://localhost:8080/';
const Config = require('../../config');
const fs = require('fs');

const testCases = [
  {
    type: 'text/html',
    sample: '/sampleUploads/sampleHtml.html',
  },
  {
    type: 'text/plain',
    sample: '/sampleUploads/sample.txt'
  },
  {
    type: 'image/jpeg',
    sample: '/sampleUploads/sampleImage.jpeg'
  }
];

describe('returns asset states', function(suite) {


  testCases.forEach((test) => {

    let runner = {};

    it('return signedURL for upload', function(done) {
      const options = {
        url: `${baseUrl}asset`,
        headers: {
          'content-type': test.type
        }
      };
      request.post(options, function(error, response, body) {
        const bodyObj = JSON.parse(body);
        expect(bodyObj.upload_url).to.match(/^https:\/\/asset-uploader-test.s3.amazonaws.com.*/);
        expect(bodyObj.id).to.match(/^[A-Za-z0-9-]/)
        expect(response.statusCode).to.equal(200);
        runner = bodyObj;
        done();
      });
    });

    it('return getSignedURL no asset uploaded', function(done) {
      const options = {
        url: `${baseUrl}asset/${runner.id}`,
        headers: {
          'content-type': test.type,
        }
      };
      request.get(options, function(error, response, body) {
        expect(response.statusCode).to.equal(403);
        done();
      });
    });

    it('return upload status', function(done) {
      const options = {
        url: runner.upload_url,
        headers: {
          'content-type': test.type,
        },
        body: fs.readFileSync(__dirname + test.sample)
      };
      request.put(options, (error, response, body) => {
        expect(response.statusCode).to.equal(200);
        done();
      });
    });

    it('return getSignedURL asset uploaded status still unloaded', function(done) {
      const options = {
        url: `${baseUrl}asset/${runner.id}`,
        headers: {
          'content-type': test.type,
        }
      };
      request.get(options, function(error, response, body) {
        expect(response.statusCode).to.equal(403);
        done();
      });
    });

    it('return set status uploaded', (done) => {
      const options = {
        url: `${baseUrl}asset/${runner.id}`,
        headers: {
          'content-type': 'application/json',
          'aws-content-type': test.type
        },
        body: {
          Status: "uploaded"
        },
        json: true
      };
      request.put(options, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        done();
      });
    });

    it('return signedURL for download WITHOUT timeout', function(done) {
      const options = {
        url: `${baseUrl}asset/${runner.id}`,
        headers: {
          'content-type': test.type,
        }
      };
      request.get(options, function(error, response, body) {
        const bodyObj = JSON.parse(body);
        expect(bodyObj.Download_url).to.match(/^https:\/\/asset-uploader-test.s3.amazonaws.com.*/);
        expect(response.statusCode).to.equal(200);
        runner.Download_url = bodyObj.Download_url;
        done();
      });
    });

    it('return consume signedURL WITHOUT timeout', function(done) {
      const options = {
        url: runner.Download_url,
      };
      request.get(options, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        expect(body).to.equal(fs.readFileSync(__dirname+test.sample).toString());
        done();
      });
    });

    it('return signedURL for download WITH timeout', function(done) {
      this.timeout(10000);
      const options = {
        url: `${baseUrl}asset/${runner.id}?timeout=2`,
        headers: {
          'content-type': test.type,
        }
      };
      request.get(options, function(error, response, body) {
        const bodyObj = JSON.parse(body);
        expect(bodyObj.Download_url).to.match(/^https:\/\/asset-uploader-test.s3.amazonaws.com.*/);
        expect(response.statusCode).to.equal(200);
        runner.Download_url = bodyObj.Download_url;
        setTimeout(done, 8000);
      });
    });

    it('return consume signedURL WITH timeout', function(done) {
      const options = {
        url: runner.Download_url,
      };
      request.get(options, function(error, response, body) {
        expect(response.statusCode).to.equal(403);
        done();
      });
    });
  });
});
