import { InfrastructureConfig } from '../../config/InfrastructureConfig';
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
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Alias, Key } from 'aws-cdk-lib/aws-kms';

export class ServerlessPreInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appId: string = scope.node.tryGetContext('appId');
        const account = process.env.ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
        // const region = regionId?.region ?? props?.env?.region;
        // const zoneName = infrastructureConfig.dnsZoneName.replace('{uid}', 'abcdef'); // TODO: replace w/ appId to make unique
        const appBucketArns = [ infrastructureConfig.regions.primary, infrastructureConfig.regions.secondary ]
            .map(region => `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${region}`);

        const s3ReplicationRole = new Role(this, 'S3ReplicationRole', {
            assumedBy: new ServicePrincipal('s3.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.s3ReplicationRoleName}-${appId}`,
        });
        /* Primary Region Bucket Policies */
        this.addReplicationRolePolicies(
            s3ReplicationRole,
            infrastructureConfig.regions.primary,
            `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.primary}`,
            `arn:aws:kms:${infrastructureConfig.regions.primary}:${account}:${infrastructureConfig.kmsAlias}`,
            infrastructureConfig.regions.secondary,
            `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.secondary}`,
            `arn:aws:kms:${infrastructureConfig.regions.secondary}:${account}:${infrastructureConfig.kmsAlias}`
        );
        /* Secondary Region Bucket Policies */
        this.addReplicationRolePolicies(
            s3ReplicationRole,
            infrastructureConfig.regions.secondary,
            `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.secondary}`,
            `arn:aws:kms:${infrastructureConfig.regions.secondary}:${account}:${infrastructureConfig.kmsAlias}`,
            infrastructureConfig.regions.primary,
            `arn:aws:s3:::${infrastructureConfig.appBucketName}-${appId}-${infrastructureConfig.regions.primary}`,
            `arn:aws:kms:${infrastructureConfig.regions.primary}:${account}:${infrastructureConfig.kmsAlias}`
        );

        // const dnsZone = new HostedZone(this, 'ServerlessHostedZone', {
        //     zoneName: zoneName,
        // });
        // const dsnZoneOutput = new CfnOutput(this, 'ServerlessHostedZoneOutput', {
        //     exportName: infrastructureConfig.dnsZoneOutput,
        //     value: zoneName
        // });

        // const sslCert = new Certificate(this, 'ServerlessCertificate', {
        //     domainName: zoneName,
        //     validation: CertificateValidation.fromDns(dnsZone),
        //     subjectAlternativeNames: [
        //         `www.${zoneName}`,
        //         zoneName,
        //         `web.${zoneName}`
        //     ]
        // });
    }

    private addReplicationRolePolicies(replicationRole: Role, sourceRegion: string, sourceBucketARN: string, sourceKeyARN: string, destinationRegion: string, destinationBucketARN: string, destinationKeyARN: string) {
        replicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:ListBucket",
                    "s3:GetReplicationConfiguration",
                    "s3:GetObjectVersionForReplication",
                    "s3:GetObjectVersionAcl"
                ],
                resources: [
                    `${sourceBucketARN}`,
                    `${sourceBucketARN}/*`
                ]
            })
        );
        replicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:ReplicateObject",
                    "s3:ReplicateDelete",
                    "s3:ReplicateTags",
                    "s3:GetObjectVersionTagging"
                ],
                // TODO: remove conditions and make policies less-restrictive
                conditions: {
                    'StringLikeIfExists': {
                        's3:x-amz-server-side-encryption': [ 'aws:kms', 'AES256' ],
                        's3:x-amz-server-side-encryption-aws-kms-key-id': [
                            `${destinationKeyARN}`
                        ]
                    }
                },
                resources: [
                    `${destinationBucketARN}/*`
                ]
            })
        );
        replicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "kms:Decrypt"
                ],
                // TODO: remove conditions and make policies less-restrictive
                conditions: {
                    'StringLike': {
                        'kms:ViaService': `s3.${destinationRegion}.amazonaws.com`,
                        'kms:EncryptionContext:aws:s3:arn': [
                            `${sourceBucketARN}/*`
                        ]
                    }
                },
                resources: [
                    `${sourceKeyARN}`
                ]
            })
        );
        replicationRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "kms:Encrypt"
                ],
                // TODO: remove conditions and make policies less-restrictive
                conditions: {
                    'StringLike': {
                        'kms:ViaService': `s3.${sourceRegion}.amazonaws.com`,
                        'kms:EncryptionContext:aws:s3:arn': [
                            `${destinationBucketARN}/*`
                        ]
                    }
                },
                resources: [
                    `${destinationKeyARN}`
                ]
            })
        );
    }
}