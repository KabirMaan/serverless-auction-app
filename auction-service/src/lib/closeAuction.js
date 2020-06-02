import AWS from "aws-sdk";

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

export async function closeAuction(auction) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: {
      id: auction.id,
    },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeValues: {
      ":status": "CLOSED",
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  await dynamoDB.update(params).promise();

  const { title, seller, highestBid } = auction;
  const { amount, bidder } = highestBid;

  if (amount !== 0) {
    const notifySeller = sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "Your item has been sold!",
          recipient: seller,
          body: `Woohoo! Your item "${title}" has been sold for £${amount}.`,
        }),
      })
      .promise();

    const notifyBidder = sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "You won and auction",
          recipient: bidder,
          body: `What a great deal! You got yourself a "${title}" for £${amount}.`,
        }),
      })
      .promise();

    return Promise.all([notifySeller, notifyBidder]);
  } else {
    await sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "No bids on your auction item :(",
          recipient: seller,
          body: `Unfortunately your item "${title}" has received no bids and has not been sold`,
        }),
      })
      .promise();

    return;
  }
}
