import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

export const handler = async (e: Record<string, string>) => {
  try {
    const stsClient = new STSClient();

    const sessionPolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "dynamodb:GetItem",
            "dynamodb:Query",
            "dynamodb:BatchGetItem",
          ],
          Resource: process.env.tableArn,
          Condition: {
            "ForAllValues:StringEquals": {
              "dynamodb:LeadingKeys": ["ALLOWED_KEY"],
              "dynamodb:Attributes": ["item", "subItem", "visibleAttribute"],
            },
          },
        },
      ],
    });

    console.log(`Session policy: ${sessionPolicy}`);
    console.log("RoleArn", process.env.assumedRoleArn);

    const assumeRoleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: process.env.assumedRoleArn,
        RoleSessionName: `temporary-credentials-for-processing-func`,
        DurationSeconds: 15 * 60,
        Policy: sessionPolicy,
      }),
    );

    const lambdaClient = new LambdaClient();
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.processFuncName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          temporaryCredentials: {
            accessKeyId: assumeRoleResponse.Credentials?.AccessKeyId,
            secretAccessKey: assumeRoleResponse.Credentials?.SecretAccessKey,
            sessionToken: assumeRoleResponse.Credentials?.SecretAccessKey,
            expiration: assumeRoleResponse.Credentials?.Expiration,
          },
          data: {
            pk: e.pk,
            sk: e.sk,
          },
        }),
      }),
    );

    const client = new DynamoDBClient({
      credentials: {
        accessKeyId: assumeRoleResponse.Credentials?.AccessKeyId as string,
        secretAccessKey: assumeRoleResponse.Credentials
          ?.SecretAccessKey as string,
        sessionToken: assumeRoleResponse.Credentials?.SecretAccessKey as string,
      },
    });
    console.log("Initialised DynamoDB client successfully");

    const items = await client.send(
      new QueryCommand({
        TableName: process.env.tableName,
        ExpressionAttributeValues: {
          ":pk": {
            S: e.pk,
          },
          ":sk": {
            S: e.sk,
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

    console.log("Completed Job");
  } catch (err) {
    console.log(`Failed to execute InputFunction: ${JSON.stringify(err)}`);
  }
};
