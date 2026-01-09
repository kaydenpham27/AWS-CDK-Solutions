#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { LambdaWithRestrictedDynamodbRowsAccessStack } from "../lib/lambda-with-restricted-dynamodb-rows-access-stack";

const app = new cdk.App();
new LambdaWithRestrictedDynamodbRowsAccessStack(
  app,
  "LambdaWithRestrictedDynamodbRowsAccessStack",
  {},
);
