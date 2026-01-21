# AWS CDK Solutions 

This repo stores implementations of AWS-native cloud architecture using AWS CDK and AWS SDK.

## Best Practices 

Development strategies for AWS CDK app might be confusing and complex, in the best effort to simplify it, I'll list some factors or principles we should always think about when developing IaaCs

### Multiple Stages Deployment Flow 
You basically should have at least 2 separated environments, for `development` and `production`. As you can at least make sure there is a fully-tested and ready-to-use `production` env, while working on new features or fixing bugs. These environment should have the exact same source codes, the only difference between them should only be the environment configurations. 

Ok, this might sound redundant or over-engineered if you are working on your personal projects, nevertheless, this is a **must** when working in professional environment. 

### Rollback Strategy 

