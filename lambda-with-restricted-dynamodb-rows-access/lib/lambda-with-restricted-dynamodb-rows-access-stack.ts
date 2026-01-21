import * as cdk from "aws-cdk-lib/core";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path from "path";

export class LambdaWithRestrictedDynamodbRowsAccessStack extends cdk.Stack {
  private inputFunc: lambda.Function;
  private processFunc: lambda.Function;
  private assumedRole: iam.Role;
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
      billing: dynamodb.Billing.onDemand({}),
    });

    this.inputFunc = new lambda.Function(this, `InputFunc`, {
      description: `Entry point of the workflow. Processing input and granting restricted permissions to ProcessFunc`,
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist")),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: `input.handler`,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        tableName: this.table.tableName,
      },
    });

    this.processFunc = new lambda.Function(this, `ProcessFunc`, {
      description: `Processing the job with restricted permission enforced by the InputFunc`,
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist")),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: `process.handler`,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        tableName: this.table.tableName,
      },
    });

    this.assumedRole = new iam.Role(this, "AssumedRole", {
      assumedBy: this.inputFunc.grantPrincipal,
      description: `Role with full DB permissions to be assumed by Input Func`,
      maxSessionDuration: cdk.Duration.minutes(60),
    });
    // Grant the assumed role full permissions to the table
    this.table.grantFullAccess(this.assumedRole);
    // Grant the Input Func permission to assume the above assumed role
    this.inputFunc.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        effect: iam.Effect.ALLOW,
        resources: [this.assumedRole.roleArn],
      }),
    );

    this.processFunc.grantInvoke(this.inputFunc);
    this.inputFunc.addEnvironment("assumedRoleArn", this.assumedRole.roleArn);
    this.inputFunc.addEnvironment("tableArn", this.table.tableArn);
    this.inputFunc.addEnvironment(
      "processFuncName",
      this.processFunc.functionName,
    );
  }
}
