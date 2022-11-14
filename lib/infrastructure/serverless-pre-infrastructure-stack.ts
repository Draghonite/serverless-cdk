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
        // const region = regionId?.region ?? props?.env?.region;
        const zoneName = infrastructureConfig.dnsZoneName.replace('{appId}', appId);

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
}