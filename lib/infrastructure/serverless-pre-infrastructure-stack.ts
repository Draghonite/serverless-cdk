import { InfrastructureConfig, TagEnum } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AuroraPostgresEngineVersion, CfnGlobalCluster, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export class ServerlessPreInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appId: string = scope.node.tryGetContext('appId');

        // #region S3 Replication Role

        new Role(this, 'S3ReplicationRole', {
            assumedBy: new ServicePrincipal('s3.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.s3ReplicationRoleName}-${appId}`,
            managedPolicies: [
                new ManagedPolicy(this, 'S3ReplicationRoleManagedPolicy', {
                    managedPolicyName: `S3ReplicationRoleManagedPolicy-${appId}`,
                    statements: [
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
                        }),
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
                    ]
                })
            ]
        });

        // #endregion

        // #region Access Logging Role

        new Role(this, 'AccessLoggingRole', {
            assumedBy: new ServicePrincipal('s3.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.accessLoggingRoleName}-${appId}`,
            managedPolicies: [
                new ManagedPolicy(this, 'AccessLoggingRoleManagedPolicy', {
                    managedPolicyName: `AccessLoggingRoleManagedPolicy-${appId}`,
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                's3:PutBucket'
                            ],
                            resources: [
                                `arn:aws:s3:::${infrastructureConfig.accessLogsBucketName}-${appId}-${infrastructureConfig.regions.primary}`,
                                `arn:aws:s3:::${infrastructureConfig.accessLogsBucketName}-${appId}-${infrastructureConfig.regions.primary}/*`,
                                `arn:aws:s3:::${infrastructureConfig.accessLogsBucketName}-${appId}-${infrastructureConfig.regions.secondary}`,
                                `arn:aws:s3:::${infrastructureConfig.accessLogsBucketName}-${appId}-${infrastructureConfig.regions.secondary}/*`,
                            ]
                        })
                    ]
                })
            ]
        });

        // #endregion

        // #region App Execution Role

        new Role(this, 'ServerlessAppExecutionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.appExecutionRoleName}-${appId}`,
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
                new ManagedPolicy(this, 'ServerlessAppExecutionRoleManagedPolicy', {
                    managedPolicyName: `ServerlessAppExecutionRoleManagedPolicy-${appId}`,
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'lambda:InvokeFunction',
                                'lambda:InvokeAsync'
                            ],
                            resources: [
                                `arn:aws:lambda:${infrastructureConfig.regions.primary}:${this.account}:function:${infrastructureConfig.apiLambdaName}-${appId}-${infrastructureConfig.regions.primary}`,
                                `arn:aws:lambda:${infrastructureConfig.regions.secondary}:${this.account}:function:${infrastructureConfig.apiLambdaName}-${appId}-${infrastructureConfig.regions.secondary}`
                            ]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'xray:PutTelemetryRecords',
                                'xray:PutTraceSegments'
                            ],
                            resources: ['*']
                        })
                    ]
                })
            ]
        });

        // #endregion

        // #region API Authorizer Role

        new Role(this, 'ServerlessAPIAuthorizerRole', {
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            path: '/service-role/',
            roleName: `${infrastructureConfig.apiAuthorizerRoleName}-${appId}`,
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
                new ManagedPolicy(this, 'ServerlessAPIAuthorizerRoleManagedPolicy', {
                    managedPolicyName: `ServerlessAPIAuthorizerRoleManagedPolicy-${appId}`,
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'lambda:InvokeFunction',
                                'lambda:InvokeAsync'
                            ],
                            resources: [
                                `arn:aws:lambda:${infrastructureConfig.regions.primary}:${this.account}:function:${infrastructureConfig.apiAuthorizerLambdaName}-${appId}-${infrastructureConfig.regions.primary}`,
                                `arn:aws:lambda:${infrastructureConfig.regions.secondary}:${this.account}:function:${infrastructureConfig.apiAuthorizerLambdaName}-${appId}-${infrastructureConfig.regions.secondary}`
                            ]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'xray:PutTelemetryRecords',
                                'xray:PutTraceSegments'
                            ],
                            resources: ['*']
                        })
                    ]
                })
            ]
        });

        // #endregion

        // #region Global RDS Cluster

        const dbEngine = DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_7 });

        const rdsGlobalCluster = new CfnGlobalCluster(this, 'ServerlessDbGlobalCluster', {
            deletionProtection: !infrastructureConfig.isDevTesting,
            engine: dbEngine.engineType,
            engineVersion: dbEngine.engineVersion?.fullVersion,
            globalClusterIdentifier: `${infrastructureConfig.globalDatabaseClusterName}-${appId}`,
            storageEncrypted: true,
        });
        Tags.of(rdsGlobalCluster).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(rdsGlobalCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

        // #endregion
    }
}