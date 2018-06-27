const AWS = require('aws-sdk');
const uuid = require('uuid');
const config = require('../../config')
const s3 = new AWS.S3();
const url = require('url');

s3.config.update({
  accessKeyId: config.aws_access_key_id,
  secretAccessKey: config.aws_secret_access_key,
  region: config.region,
  signatureVersion: 'v4',
});

module.exports = (app) => {

  const getMetaData = (assetId) => {
    return new Promise((resolve, reject) => {
      params = {
        Bucket: config.bucket,
        Key: assetId,
      }
      s3.headObject(params, (err, data) => {
        if(err) {
          resolve(err);
        } else {
          if(data.Metadata && data.Metadata['x-amz-meta-updload-status'] === 'uploaded') {
            resolve('uploaded');
          }
        }
        resolve({error: 'Asset not uploaded', statusCode: 403});
      });
    }).catch((err) => {
      throw new Error(err);
    });
  };

  const createSignedUrl = (opts) => {
    return new Promise ((resolve, reject) => {
      s3.getSignedUrl(opts.operation, opts.params, (err, signedURL) => {
        if(err) {
          console.log('err = ', err);
          resolve(err);
        } else {
          if(opts.operation === 'getObject') {
            resolve({Download_url: signedURL});
          } else if(opts.operation === 'putObject'){
            resolve({
              upload_url: signedURL,
              id: url.parse(signedURL, true).pathname.replace('/', '')
            });
          } else {
            resolve({ERROR: 'Unexpected operation...'})
          }
        }
      });
    }).catch((err) => {
      throw new Error(err);
    });
  };

  const updateMetaData = (opts) => {
    return new Promise ((resolve, reject) => {
      s3.copyObject(opts, (err, data) => {
        if(err) resolve(err);
        else resolve({Status: 'uploaded'});
      });
    }).catch((err) => {
      throw new Error(err);
    });
  }

  app.post('/asset', async (req, res) => {
    const opts = {
      operation: 'putObject',
      params: {
        Bucket: config.bucket,
        Key: uuid.v4(),
        ContentType: req.headers['content-type'],
        ACL: 'public-read',
        Metadata: {
          'x-amz-meta-updload-status': 'none'
        }
      }
    };
    const response = await createSignedUrl(opts);
    res.send(response);
  });

  app.get('/asset/:assetId', async(req, res) => {
    try {
      console.log('req.query = ', req.query);
      const meta = await getMetaData(req.params.assetId);
      if(await meta !== 'uploaded'){
        res.status(403);
        res.send(meta);
      } else {
        const options = {
          operation: 'getObject',
          assetId: req.params.assetId,
          params: {
            Bucket: config.bucket,
            Key: req.params.assetId,
            Expires: req.query.timeout || 60
          }
        }
        const presignedUrl = await createSignedUrl(options);
        res.send(presignedUrl);
      }
    } catch (err) {
      res.send({error: err});
    }
  });

  app.put('/asset/:assetId', async (req, res) => {
    // headers:
    //    content-type application/json
    //    aws-content-type whatever-content-was-previously-uploaded
    const params = {
      Bucket: config.bucket,
      Key: req.params.assetId,
      CopySource: `${config.bucket}/${req.params.assetId}`,
      ContentType: req.headers['aws-content-type'],
      Metadata: {
        'x-amz-meta-updload-status': req.body.Status
      },
      MetadataDirective: 'REPLACE',
      ACL: 'public-read'
    };
    const response = await updateMetaData(params);
    if(response.Status && response.Status === 'uploaded'){
      res.status(200);
      res.send();
    } else {
      res.status(403);
      res.send(response);
    }
  });
}
