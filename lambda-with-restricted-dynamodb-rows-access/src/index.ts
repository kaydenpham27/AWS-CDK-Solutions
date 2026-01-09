import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

export const handler = async (e: any) => {
  try {
    const client = new DynamoDBClient({
      region: process.env.REGION,
    });
    const items = await client.send(
      new QueryCommand({
        TableName: process.env.tableName,
        ExpressionAttributeValues: {
          ":v1": {
            S: "ALLOWED_KEY",
          },
        },
        KeyConditionExpression: "item = :v1",
      }),
    );

    console.log(
      `Received ${items.Count} items from table ${process.env.tableName}`,
    );
  } catch (err) {
    console.log(`Failed to execute: ${JSON.stringify(err)}`);
  }
};
