import { PolicyStatement, Effect, ArnPrincipal, AnyPrincipal } from 'aws-cdk-lib/aws-iam';
import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Fn, RemovalPolicy } from 'aws-cdk-lib';
import { Alias } from 'aws-cdk-lib/aws-kms';

export class ServerlessInfrastructureContentBucketStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;
        
        const appId: string = scope.node.tryGetContext('appId');
        const region = props?.env?.region;
        const destinationBucketRegion = (region !== infrastructureConfig.regions.primary) ? infrastructureConfig.regions.primary : infrastructureConfig.regions.secondary;
        const kmsEncryptionKey = Alias.fromAliasName(this, 'ServerlessAppS3KMSLookup', infrastructureConfig.kmsAlias);

        // #region Content Bucket

        const contentBucket = new Bucket(this, 'ServerlessAppContentBucket', {
            bucketName: `${infrastructureConfig.contentBucketName}-${appId}-${region}`,
            versioned: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS,
            encryptionKey: kmsEncryptionKey,
            bucketKeyEnabled: true,
            autoDeleteObjects: infrastructureConfig.isDevTesting,
            removalPolicy: infrastructureConfig.isDevTesting ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
        });
        contentBucket.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [
                new ArnPrincipal(Fn.sub(`arn:aws:iam::\${AWS::AccountId}:role/service-role/${infrastructureConfig.s3ReplicationRoleName}-${appId}`))
            ],
            actions: [
                "s3:ObjectOwnerOverrideToBucketOwner",
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
                `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${region}/*`
            ]
        }));

        if (scope.node.tryGetContext('shouldConfigureReplication')) {
            (contentBucket.node.defaultChild as CfnBucket).replicationConfiguration = {
                role: Fn.sub('arn:aws:iam::${AWS::AccountId}:role/service-role/'+`${infrastructureConfig.s3ReplicationRoleName}-${appId}`),
                rules: [
                    {
                        id: `s3-replication-rule-${region}-to-${destinationBucketRegion}`,
                        status: 'Enabled',
                        prefix: '',
                        destination: {
                            bucket: `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${destinationBucketRegion}`,
                            encryptionConfiguration: {
                                replicaKmsKeyId: Fn.sub(`arn:aws:kms:${destinationBucketRegion}:\${AWS::AccountId}:${infrastructureConfig.kmsAlias}`)
                            }
                        },
                        sourceSelectionCriteria: {
                            sseKmsEncryptedObjects: { status: 'Enabled' }
                        }
                    }
                ]
            };
        }

        // #endregion

        // #region Access Log Bucket

        const accessLogBucket = new Bucket(this, 'ServerAppAccessLogBucket', {
            bucketName: `${infrastructureConfig.accessLogsBucketName}-${appId}-${region}`,
            versioned: false,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS,
            encryptionKey: kmsEncryptionKey,
            bucketKeyEnabled: true,
            autoDeleteObjects: infrastructureConfig.isDevTesting,
            removalPolicy: infrastructureConfig.isDevTesting ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
        });
        // contentBucket.addToResourcePolicy(new PolicyStatement({
        //     effect: Effect.ALLOW,
        //     principals: [
        //         new ArnPrincipal(Fn.sub(`arn:aws:iam::\${AWS::AccountId}:role/service-role/${infrastructureConfig.accessLoggingRoleName}-${appId}`))
        //     ],
        //     actions: [
        //         "s3:PutObject"
        //     ],
        //     resources: [
        //         `arn:aws:s3:::${infrastructureConfig.accessLogsBucketName}-${appId}-${region}/*`
        //     ]
        // }));

        // #endregion
    }
}
