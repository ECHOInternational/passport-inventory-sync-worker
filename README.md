# passport-inventory-sync-worker
Processes inventory records, combining inventory counts with item property data. Writes combined data to separate queues for updating the Plant API and the web store. Once the process is complete an optional SNS message is sent.

## Required Environment Variables

### TASK_QUEUE_URL
This is the url (not the arn) for the SQS queue that calls this function. The URL is required to ensure that the items are deleted from the queue when the tasks are complete.
*Your Lambda fucntion must have read and delete priveleges to this queue.*

### API_BASE_URL
_Example:_ https://api.mydomain.com/v1/
This is the base url for the api from which to retrieve plant data.

### STORE_QUEUE_URL
This is the url (not the arn) for the SQS queue in which data will be placed for processing by the web store.
*Your Lambda function must have write priveleges to this queue.*

### API_QUEUE_URL
This is the url (not the arn) for the SQS queue in which data will be placed for updating the plant api.
*Your Lambda function must have write priveleges to this queue.*

### Optional Environment Variables

### NOTIFY_SNS
Value must be "true" or "false" - If omitted, defaults to false.

### SNS_TOPIC_ARN
A message will be sent to this SNS topic when processing completes.
*If used, your Lambda function must have send priveleges for this topic.*