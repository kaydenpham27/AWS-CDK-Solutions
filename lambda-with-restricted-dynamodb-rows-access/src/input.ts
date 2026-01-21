import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

export const handler = async (e: Record<string, string>) => {
  try {
    console.log("Region: ", process.env.AWS_REGION);

    const stsClient = new STSClient({
      region: process.env.AWS_REGION,
    });

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
              // "dynamodb:Attributes": ["item", "subItem", "visibleAttribute"],
            },
          },
        },
      ],
    });

    const assumeRoleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: process.env.assumedRoleArn,
        RoleSessionName: `session-${Date.now()}`,
        DurationSeconds: 15 * 60,
        Policy: sessionPolicy,
      }),
    );

    console.log(`Assumed role: ${process.env.assumedRoleArn} successfully`);
    // console.log(`Response: ${JSON.stringify(assumeRoleResponse)}`);

    const lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION,
    });
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.processFuncName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          temporaryCredentials: {
            accessKeyId: assumeRoleResponse.Credentials?.AccessKeyId,
            secretAccessKey: assumeRoleResponse.Credentials?.SecretAccessKey,
            sessionToken: assumeRoleResponse.Credentials?.SessionToken,
            expiration: assumeRoleResponse.Credentials?.Expiration,
          },
          data: {
            pk: e.pk,
            sk: e.sk,
          },
        }),
      }),
    );

    console.log("Completed Job");
  } catch (err) {
    console.log(`Failed to execute InputFunction: ${JSON.stringify(err)}`);
  }
};
