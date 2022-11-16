import { InfrastructureConfig } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

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
                    `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.primary}`,
                    `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.primary}/*`,
                    `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.secondary}`,
                    `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.secondary}/*`,
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
    }
}