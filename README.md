#serverless-cdk
## Built-up manually from the ground up to showcase

- AWS CDK
- TypeScript
- Managing of CloudFormation automation code for stacks involving:
  - Infrastructure (including provisioning of TODO);

![Architecture Diagram](architecture.png)

## How to Use
Knowledge of and prior configuration of the AWS CDK is assumed.  See below for useful commands.  Otherwise, the following provides for a few useful scenarios:

* `APP_ID={appid} cdk deploy --all` deploys the application and all the stacks configured (see serverless-cdk.ts), in the appropriate sequence.  This sets the `APP_ID` environment variable.
* `cdk deploy --all` deploys the app without environment variables but expects that the `appId` parameter be configured in the application's configuration file (see InfrastructureConfig.ts); if not configured, then a detailed exception notifies of this pre-requisite.
* `APP_ID={appid} INCLUDE_REPLICATION={yes|true} cdk deploy --all` deploys the app with the `APP_ID` environment variables and the inclusion of `INCLUDE_REPLICATION` with a truthy value (yes/true, non-case sensitive); adding this variable ensures that the S3 content buckets receive the configuration of S3 Replication rules appropriately.

NOTE: It is important to note that in order to deploy the S3 Replication rules across regions/stacks, a basic deployment must first be completed WITHOUT the rules, followed by the same deployment -- same stack(s) -- but with the replication options in place.  To accomplish this, deploy the app without, then with the `INCLUDE_REPLICATION` environment variable set.

NOTE: Replace the tokens in the example accordingly; these are defined below:

- `{appid}` is a unique identifier for the CDK application and is used throughout the project to ensure uniqueness in certain cases; for instance in the naming of the S3 Buckets where global uniqueness is required.  While the length constraints for this value actually depend on the specific resource that uses the appId, a short value (1-10 characters) is recommended.
- `INCLUDE_REPLICATION={yes|true}` provides the optional configuration of S3 Replication rules, used by conditional logic in the appropriate stack.

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
* `cdk destroy`      destroys the CloudFormation stack(s); if multiple exist, can provide the name(s) comma-delimited or `--all`

### Disclaimer 
Use of this solution is for academic purposes only and neither this site nor contributors to this repository are liable for costs resulting from use of any automation code contained nor referenced within.  Use at your own discretion and ensure to understand the risks of provisioning cloud infrastructure and resources, especially through automation.  It is highly encouraged to have a solid understanding of the cloud service provider(s) used and the processes for identification of provisioned resources and related costs, as well as how to decommission resources to reduce and eliminate costs.

### Credits and Resources:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-aws-javascript.html
- https://sbstjn.com/blog/aws-cdk-lambda-loadbalancer-vpc-certificate/
- https://nikhil-zadoo.com/custom-resources-with-aws-cdk
- https://stackoverflow.com/questions/67361096/how-can-i-zip-node-lambda-dependencies-in-aws-cdk-stack
- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html
- https://github.com/aws/aws-cdk/issues/1635
- https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_core.AppProps.html
- https://stackoverflow.com/questions/6248666/how-to-generate-short-uid-like-ax4j9z-in-js
- https://app.diagrams.net/
- https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-i-strategies-for-recovery-in-the-cloud/
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-config-for-kms-objects.html
- https://bobbyhadz.com/blog/environment-variables-aws-cdk
- https://github.com/aws/aws-cdk/issues/3235
- https://aws.amazon.com/premiumsupport/knowledge-center/s3-troubleshoot-replication/
- https://www.digitalocean.com/community/tools/minify