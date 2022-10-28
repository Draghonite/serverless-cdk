#serverless-cdk
## Built-up manually from the ground up to showcase

- AWS CDK
- TypeScript
- Managing of CloudFormation automation code for stacks involving:
  - Infrastructure (including provisioning of TODO);

![Architecture Diagram](architecture.png)

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

### Credits:
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