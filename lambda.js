var AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-1'});
const request = require("request-promise-native");

const sqs = new AWS.SQS();
const sns = new AWS.SNS();


const base_url = process.env.API_BASE_URL;
const incoming_queue_url = process.env.TASK_QUEUE_URL;
const store_queue_url = process.env.STORE_QUEUE_URL;
const api_queue_url = process.env.API_QUEUE_URL;
const sns_topic_arn = process.env.SNS_TOPIC_ARN;
const notify_sns = process.env.NOTIFY_SNS;


const headers = {
  'Accept': 'application/vnd.api+json'
};

const stock_item_path = '/plant-stock-items/';

var lambda_callback;
var errors = [];

var languages = [];
var call_count = 0;

var stock_item_id = null;
var meta_data = null;
var inventory_data = null;
var stock_item_data = {};

var store_api_task_complete = false;
var plant_api_task_complete = false;

function stock_item_url_by_stock_id(stock_id) {
  return base_url+stock_item_path+"?filter[stock-item-id]="+stock_id;
}

function stock_item_url_by_id(id) {
  return base_url+stock_item_path+id;
}

exports.handler = function(event, context, callback) {
  lambda_callback = callback;

  records = event.Records;

  inventory_data = records[0].body;
  receipt_handle = records[0].receiptHandle;

  console.log(inventory_data);

  find_stock_item(inventory_data.StockItemNumber);
};

function find_stock_item(id_string){
  request({ url: stock_item_url_by_stock_id(id_string), json: true, headers: headers}).then(
    function(response){
      if(response.meta['record-count'] > 0){
        stock_item_id = response.data[0].id;
        meta_data = response.data[0].meta;
        languages = meta_data.available_languages;
        for (i=0; i<languages.length; i++){
          get_stock_item_data_by_language(stock_item_id, languages[i]);
        }
      } else {
        console.log("No Record Found.");
        complete_data_collection();
      }
    },
    lambda_callback
  );
}

function get_stock_item_data_by_language(stock_item_id, language){
  request({url: stock_item_url_by_id(id)+"?locale"+language, json: true, headers: headers}).then(
    process_stock_item,
    function(error){
      console.error(error);
      call_count++;
      complete_data_collection();
    }
  );
}

function process_stock_item(response) {
  key = response.data.meta.requested_language;
  value = response.data.attributes;

  stock_item_data[key] = value;

  call_count++;
  complete_data_collection();
}

function complete_data_collection() {
  console.log("Data collected for " + call_count + " of " + languages.length + " languages.");
  if(call_count === languages.length){
    console.log("Data Collection Complete");
    store_api_task();
    plant_api_task();
  }
}

function plant_api_task(){
  params = {
    DelaySeconds: 0,
    MessageBody: JSON.stringify(inventory_data),
    QueueUrl: api_queue_url
  };
  sqs.sendMessage(params, function(err, data){
    if(err){ errors.push([err, data]);}
    console.log("Plant API Task Complete.");
    plant_api_task_complete = true;
    complete_task();
  });
}

function store_api_task(){
  if(stock_item_id){
    params = {
      DelaySeconds: 0,
      MessageBody: JSON.stringify(stock_item_data),
      QueueUrl: store_queue_url
    };
    sqs.sendMessage(params, function(err, data){
      if(err){ errors.push([err, data]);}
      console.log("Store API Task Complete.");
      store_api_task_complete = true;
      complete_task();
    });
  }else {
    console.log("Skipping store update, no record found.");
    store_api_task_complete = true;
    complete_task();
  }
}

function complete_task(){
  if(plant_api_task_complete && store_api_task_complete){
    deleteQueueEntry(receipt_handle, incoming_queue_url, finalize);
  }
}

function deleteQueueEntry(receipt_handle, queue_url, callback){
  sqs.deleteMessage({
      ReceiptHandle: receipt_handle,
      QueueUrl: queue_url
  }, function(err, data){
    if(err){ errors.push([err, data]); }
    sendSnsMessage("Task Complete", callback);
  });
}

function sendSnsMessage(message_body, callback){
  params = {
    TopicArn: sns_topic_arn,
    Message: message_body +": "+ new Date().toLocaleString()
  };
  if(notify_sns){
    console.log("Sending SNS Message");
    sns.publish(params, callback);
  }else{
    callback();
  }
}

function finalize(err, data){
  if(err){ errors.push([err, data]); }

  if(errors.length === 0){
    lambda_callback();
  }else{
    lambda_callback(errors);
  }
}