import { InfrastructureConfig } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { CustomResource, Fn } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { readFileSync } from 'fs';
import * as path from 'path';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

export class ServerlessPostInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const shortId: string = scope.node.tryGetContext('shortId');
        
        const lambdaCustomProvider = new lambda.Function(this, 'CustomLambdaReplicationHandler', {
            functionName: infrastructureConfig.lambdaCustomHandlerName,
            runtime: lambda.Runtime.NODEJS_16_X,
            
            // NOTE: alternative 1 - automatically zips the folder (from 'code' field) to later extract and executes the {file_name}.{function_name} (from 'handler' field)
            // code: lambda.Code.fromAsset('resources'),
            // handler: 'create-s3-replication-handler.handler',

            // NOTE: alternative 2 - uses the raw code (4KB max, from 'code' field) and executes the {file_name}.{function_name} (from 'handler' field)
            code: lambda.Code.fromInline(readFileSync(path.join(__dirname, '../../resources/create-s3-replication-handler.js')).toString()),
            handler: 'index.handler',

            environment: {
                BUCKET_NAME: `${infrastructureConfig.appBucketName}-${shortId}`,
                PRIMARY_REGION: infrastructureConfig.regions.primary,
                REPLICATION_ROLE_ARN: Fn.sub("arn:aws:iam::${AWS::AccountId}:role/service-role/"+`${infrastructureConfig.s3ReplicationRoleName}-${shortId}`),
                SECONDARY_REGION: infrastructureConfig.regions.secondary
            },
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            // TODO: secure by placing within the private, internal vpc
            // vpc: Vpc.fromLookup(this, 'LambdaCustomProviderVpcLookup', {
            //     vpcName: infrastructureConfig.vpcName
            // }),
            // vpcSubnets: {
            //     subnetGroupName: infrastructureConfig.appLambdaSubnetGroupName
            // }
        });
        lambdaCustomProvider.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "s3:*"
            ],
            resources: [
                `arn:aws:s3:::${infrastructureConfig.appBucketName}-*`
            ]
        }));
        lambdaCustomProvider.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "iam:GetRole",
                "iam:PassRole"
            ],
            resources: [
                Fn.sub("arn:aws:iam::${AWS::AccountId}:role/service-role/"+`${infrastructureConfig.s3ReplicationRoleName}-${shortId}`)
            ]
        }));

        const customS3AppReplicationProvider = new Provider(this, 'CustomS3AppReplicationProvider', {
            onEventHandler: lambdaCustomProvider
        });
        const customS3AppReplicationResource = new CustomResource(this, 'CustomS3ReplicationResource', {
            serviceToken: customS3AppReplicationProvider.serviceToken
        });

        customS3AppReplicationProvider.node.addDependency(lambdaCustomProvider);
        customS3AppReplicationResource.node.addDependency(customS3AppReplicationProvider);
    }
}