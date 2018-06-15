var AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-1'});

var TASK_QUEUE_URL = process.env.TASK_QUEUE_URL;

var sqs = new AWS.SQS();
var s3 = new AWS.S3();

function deleteMessage(receiptHandle, callback) {
  sqs.deleteMessage({
    ReceiptHandle: receiptHandle,
    QueueUrl: TASK_QUEUE_URL
  }, callback);
}

function work(task, callback) {
  console.log(task);
  // TODO implement
  callback();
}

exports.handler = function(event, context, callback) {
  work(event.Body, function(err) {
    if (err) {
      callback(err);
    } else {
      deleteMessage(event.ReceiptHandle, callback);
    }
  });
};