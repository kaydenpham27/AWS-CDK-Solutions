import * as cdk from "aws-cdk-lib/core";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path from "path";

export class LambdaWithRestrictedDynamodbRowsAccessStack extends cdk.Stack {
  private func: lambda.Function;
  private table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.TableV2(this, `TestTable`, {
      partitionKey: {
        name: "item",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "subItem",
        type: dynamodb.AttributeType.STRING,
      },
      billing: dynamodb.Billing.onDemand({
        // maxReadRequestUnits:
        // maxWriteRequestUnits
      }),
    });

    this.func = new lambda.Function(this, `TestFunc`, {
      description: `This is a test function with read-restricted permissions to DynamoDB selected rows`,
      code: lambda.Code.fromAsset(path.join(__dirname, "")),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: `index.handler`,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        tableName: this.table.tableName,
      },
    });

    this.func.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
        ],
        principals: [
          iam.ServicePrincipal.fromStaticServicePrincipleName(
            "lambda.amazonaws.com",
          ),
        ],
        resources: [this.table.tableArn],
        conditions: {
          "ForAllValues:StringEquals": {
            "dynamodb:LeadingKeys": ["ALLOWED_KEY"],
          },
        },
      }),
    );
  }
}
