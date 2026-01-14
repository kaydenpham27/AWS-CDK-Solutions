import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

type EventProps = {
  temporaryCredentials: {
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    sessionToken: string | undefined;
    expiration: string | undefined;
  };
  data: Record<string, string>;
};

export const handler = async (e: EventProps) => {
  try {
    console.log(`Event: ${JSON.stringify(e)}`);
    const { temporaryCredentials, data } = e;

    console.log("Credentials", JSON.stringify(temporaryCredentials));
    if (
      temporaryCredentials.expiration &&
      new Date(temporaryCredentials.expiration).getTime() < new Date().getTime()
    ) {
      console.log("Credentials expired");
      return;
    }

    const credentialConfig =
      temporaryCredentials.accessKeyId &&
      temporaryCredentials.secretAccessKey &&
      temporaryCredentials.sessionToken
        ? {
            accessKeyId: temporaryCredentials.accessKeyId,
            secretAccessKey: temporaryCredentials.secretAccessKey,
            sessionToken: temporaryCredentials.sessionToken,
          }
        : undefined;

    const client = new DynamoDBClient({
      credentials: credentialConfig,
    });
    console.log("Initialised DynamoDB client successfully");

    const items = await client.send(
      new QueryCommand({
        TableName: process.env.tableName,
        ExpressionAttributeValues: {
          ":pk": {
            S: data.pk,
          },
          ":sk": {
            S: data.sk,
          },
        },
        ExpressionAttributeNames: {
          "#item": "item",
          "#subItem": "subItem",
        },
        KeyConditionExpression: "#item = :pk AND begins_with(#subItem, :sk)",
      }),
    );

    console.log(
      `Received ${items.Count} items from table ${process.env.tableName}`,
    );
    for (const item of items.Items || []) {
      console.log(JSON.stringify(item));
    }

    return items;
  } catch (err) {
    console.log(
      `Failed to execute: ${
        err instanceof Error
          ? JSON.stringify({
              name: err.name,
              message: JSON.stringify(err.message),
              stack: JSON.stringify(err.stack),
              cause: JSON.stringify(err.cause),
            })
          : "Unknown Error"
      }`,
    );
    return err;
  }
};
