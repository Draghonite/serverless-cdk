import { InfrastructureConfig } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class ServerlessPreInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appId: string = scope.node.tryGetContext('appId');

        const s3ReplicationRole = new Role(this, 'S3ReplicationRole', {
            assumedBy: new ServicePrincipal('s3.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.s3ReplicationRoleName}-${appId}`
        });
        s3ReplicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:ListBucket",
                    "s3:GetReplicationConfiguration",
                    "s3:GetObjectVersionForReplication",
                    "s3:GetObjectVersionAcl",
                    "s3:GetObjectLegalHold",
                    "s3:GetObjectRetention",
                    "s3:ReplicateObject",
                    "s3:ReplicateDelete",
                    "s3:ReplicateTags",
                    "s3:GetObjectVersionTagging"
                ],
                resources: [
                    `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${infrastructureConfig.regions.primary}`,
                    `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${infrastructureConfig.regions.primary}/*`,
                    `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${infrastructureConfig.regions.secondary}`,
                    `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${infrastructureConfig.regions.secondary}/*`,
                ]
            })
        );
        s3ReplicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "kms:Encrypt",
                    "kms:Decrypt",
                    "kms:ReEncrypt*",
                    "kms:GenerateDataKey"
                ],
                resources: [
                    'arn:aws:kms:*:*:*'
                ]
            })
        );

        const apiAuthorizerRole = new Role(this, 'ServerlessAPIAuthorizerRole', {
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.apiAuthorizerRoleName}-${appId}`
        });
        apiAuthorizerRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );
        apiAuthorizerRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
        );
        apiAuthorizerRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'lambda:InvokeFunction',
                    'lambda:InvokeAsync'
                ],
                resources: [
                    `arn:aws:lambda:${infrastructureConfig.regions.primary}:${this.account}:function:${infrastructureConfig.apiAuthorizerLambdaName}`,
                    `arn:aws:lambda:${infrastructureConfig.regions.secondary}:${this.account}:function:${infrastructureConfig.apiAuthorizerLambdaName}`,
                    `arn:aws:lambda:${infrastructureConfig.regions.primary}:${this.account}:function:${infrastructureConfig.apiLambdaName}`,
                    `arn:aws:lambda:${infrastructureConfig.regions.secondary}:${this.account}:function:${infrastructureConfig.apiLambdaName}`
                ]
            })
        );
        apiAuthorizerRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'xray:PutTelemetryRecords',
                    'xray:PutTraceSegments'
                ],
                resources: ['*']
            })
        );
    }
}