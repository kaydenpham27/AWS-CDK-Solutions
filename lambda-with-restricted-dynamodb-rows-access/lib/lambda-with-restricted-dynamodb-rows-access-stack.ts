import * as cdk from "aws-cdk-lib/core";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path from "path";

export class LambdaWithRestrictedDynamodbRowsAccessStack extends cdk.Stack {
  private inputFunc: lambda.Function;
  private processFunc: lambda.Function;
  // Role to be assumed by processing func during execution
  private processFuncAssumedRole: iam.Role;
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

    this.inputFunc = new lambda.Function(this, `InputFunc`, {
      description: `This is an input function with full permissions to DynamoDB table and permission to grant permission to ProcessFunc`,
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist")),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: `input.handler`,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        tableName: this.table.tableName,
      },
    });

    this.processFunc = new lambda.Function(this, `ProcessFunc`, {
      description: `This is a processing function with read-restricted permissions to DynamoDB selected rows`,
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist")),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: `process.handler`,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        tableName: this.table.tableName,
      },
    });

    this.processFuncAssumedRole = new iam.Role(this, "Lambda-Assumed-Role", {
      assumedBy: this.inputFunc.grantPrincipal,
      description: `Temporary role for process function to assume`,
      maxSessionDuration: cdk.Duration.minutes(60),
    });

    // Allows input function to invoke process function
    this.processFunc.grantInvoke(this.inputFunc);
    // Grants the role to be assumed by process function all permissions for DynamoDB table
    this.table.grantFullAccess(this.processFuncAssumedRole);

    this.inputFunc.addEnvironment(
      "assumedRoleArn",
      this.processFuncAssumedRole.roleArn,
    );
    this.inputFunc.addEnvironment("tableArn", this.table.tableArn);
    this.inputFunc.addEnvironment(
      "processFuncName",
      this.processFunc.functionName,
    );
    this.inputFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        effect: iam.Effect.ALLOW,
        resources: [this.processFuncAssumedRole.roleArn],
      }),
    );

    //? Permanent policy statement assigned to ProcessFunc
    // this.processFunc.addToRolePolicy(
    //   new iam.PolicyStatement({
    //     actions: [
    //       "dynamodb:GetItem",
    //       "dynamodb:Query",
    //       "dynamodb:BatchGetItem",
    //     ],
    //     resources: [this.table.tableArn],
    //     conditions: {
    //       "ForAllValues:StringEquals": {
    //         // "dynamodb:LeadingKeys": ["ALLOWED_KEY"],
    //         "dynamodb:Attributes": ["item", "subItem", "visibleAttribute"],
    //       },
    //       "StringEqualsIfExists": {
    //         "dynamodb:Select": "SPECIFIC_ATTRIBUTES",
    //         "dynamodb:ReturnValues":[
    //               "NONE",
    //               "UPDATED_OLD",
    //               "UPDATED_NEW"
    //            ]
    //       }
    //     },
    //   }),
    // );
  }
}
