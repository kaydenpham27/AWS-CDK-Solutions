# Lambda With Restricted DynamoDB Access 

![Diagram](LambdaWithRestrcitedDynamoDBAccess.drawio.png)

# Scenario 

Imagine you're architecting a system where you chain multiple `Lambda Functions` together to form a processing workflow, and you intentionally give users the permissions to deploy their own code to one of the processing `Lambda Functions`, **without AWS Console or CLI access**. These processing functions are given permissions to some extent to access other `AWS services` within the same account.

However, because you don't have control over what users will do with their own code, a malicious actor could exploit the Lambda Function's permissions to steal data from the system or access resources beyond their scope. As a result, you need to find a way to limit the permissions of the processing functions to only the resources that are associated with each specific user.

# Solution

Instead of giving the processing functions fixed permissions from the `provisioning phase`, we generate `dynamic` and `temporary` credentials at runtime using AWS STS (Security Token Service).

# Architecture
The solution uses a two-tier Lambda architecture:
1. Input Processing Function (Trusted)
This function is controlled by you (users cannot deploy code here)
Granted full permissions to assume a restricted role via sts:AssumeRole
Responsible for:
  - Sanitizing and validating inputs
  - Determining which resources the user should access
  - Using AWS STS AssumeRole to generate temporary, scoped credentials
  - Passing the temporary credentials to the processing functions

2. Processing Functions (User-controlled)
Users can deploy their own code to these functions
These functions have no direct IAM permissions to sensitive resources
They only receive:
  - Input data from the Input Processing Function
  - Temporary credentials with restricted access

These credentials are scoped to only the resources the user owns/is authorized to access