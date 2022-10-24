import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, CfnBucket, CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3';

export class ServerlessDRInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appBucketArns = cdk.Fn.importListValue(infrastructureConfig.appBucketArnOutput, 1);
        const regionIdMap: Map<string, any> = scope.node.tryGetContext('regionIdMap');
        const regionId = regionIdMap.get(props?.env?.region || '');
        const shortId: string = scope.node.tryGetContext('shortId');
        const accountId: string = scope.node.tryGetContext('account');
        const region = regionId?.region ?? props?.env?.region;
        const account = accountId ?? props?.env?.account;

        // #region Replication Roles
        // create an IAM service role for replication and adds role policies to allow replication, used across both buckets -- see https://sbstjn.com/blog/aws-cdk-s3-cross-region-replication-kms/
        const s3ReplicationRole = new Role(this, 'S3ReplicationRole', {
            assumedBy: new ServicePrincipal('s3.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.s3ReplicationRoleName}-${region}-${shortId}`
        });
        s3ReplicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:InitiateReplication",
                    "s3:GetReplicationConfiguration",
                    "s3:PutInventoryConfiguration"
                ],
                resources: appBucketArns.map(value => `${value}/*`)
            })
        );
        s3ReplicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:ListBucket",
                    "s3:GetReplicationConfiguration"
                ],
                resources: appBucketArns.map(value => `${value}`)
            })
        );
        s3ReplicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:ReplicateObject",
                    "s3:ReplicateDelete",
                    "s3:ReplicateTags"
                ],
                resources: appBucketArns.map(value => `${value}/*`)
            })
        );

        // TODO: update above policies to match as below -- source/destination reverse and ensure to pass account and region details
        /*

        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "s3:ListBucket",
                        "s3:GetReplicationConfiguration",
                        "s3:GetObjectVersionForReplication",
                        "s3:GetObjectVersionAcl",
                        "s3:GetObjectVersionTagging",
                        "s3:GetObjectRetention",
                        "s3:GetObjectLegalHold"
                    ],
                    "Effect": "Allow",
                    "Resource": [
                        "${sourceBucketARN}",
                        "${sourceBucketARN}/*"
                    ]
                },
                {
                    "Action": [
                        "s3:ReplicateObject",
                        "s3:ReplicateDelete",
                        "s3:ReplicateTags",
                        "s3:GetObjectVersionTagging",
                        "s3:ObjectOwnerOverrideToBucketOwner"
                    ],
                    "Effect": "Allow",
                    "Condition": {
                        "StringLikeIfExists": {
                            "s3:x-amz-server-side-encryption": [
                                "aws:kms",
                                "AES256"
                            ]
                        }
                    },
                    "Resource": [
                        "${destinationBucketARN}/*"
                    ]
                },
                {
                    "Action": [
                        "kms:Decrypt"
                    ],
                    "Effect": "Allow",
                    "Condition": {
                        "StringLike": {
                            "kms:ViaService": "s3.${sourceRegion}.amazonaws.com",
                            "kms:EncryptionContext:aws:s3:arn": [
                                "${sourceBucketARN}/*"
                            ]
                        }
                    },
                    "Resource": [
                        "arn:aws:kms:${sourceRegion}:${account}:alias/aws/s3"
                    ]
                },
                {
                    "Action": [
                        "kms:Encrypt"
                    ],
                    "Effect": "Allow",
                    "Condition": {
                        "StringLike": {
                            "kms:ViaService": [
                                "s3.${destinationRegion}.amazonaws.com"
                            ],
                            "kms:EncryptionContext:aws:s3:arn": [
                                "${destinationBucketARN}/*"
                            ]
                        }
                    },
                    "Resource": [
                        "arn:aws:kms:${destinationRegion}:${account}:alias/aws/s3"
                    ]
                }
            ]
        }

        */

        // #endregion

        // #region Multi-Region Access Point in S3 for all-way replication across regions for the app buckets
        // ...https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiRegionAccessPoints.html
        // ...https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.CfnMultiRegionAccessPoint.html
        // NOTE: can create the multi-region access point w/ both buckets, but have not found a way to add replication rules
        // ...resorting to using the API instead (in Node.js) to create the replication rules directly on the S3 buckets

        // const appBucketMultiRegionAccessPoint = new CfnMultiRegionAccessPoint(this, 'ServerlessAppBucketMRAP', {
        //     name: `${infrastructureConfig.appBucketMultiRegionAccessPointName}-${shortId}`,
        //     regions: Array.from(regionIdMap.values()).map((regionId: any) => { 
        //         return { 
        //             bucket: `${infrastructureConfig.appBucketName}-${regionId.region}-${regionId.uuid}`
        //         }
        //     })
        // });

        // #endregion
    }
}