import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket } from 'aws-cdk-lib/aws-s3';
import * as uuid from 'uuid';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, Fn, RemovalPolicy, CfnParameter } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal, Effect, IPrincipal } from 'aws-cdk-lib/aws-iam';
import { Alias } from 'aws-cdk-lib/aws-kms';
    
export interface CustomStackProps extends cdk.StackProps {
    shouldConfigureReplication: boolean;
}

export class ServerlessInfrastructureContentBucketStack extends cdk.Stack {

    // ContentBucket: Bucket;

    // protected allocateLogicalId(cfnElement: cdk.CfnElement): string {
    //     // return "ServerlessAppContentBucketResource"+Math.floor(Math.random() * 100);
    //     return cfnElement.node.id;
    // }

    constructor(scope: Construct, id: string, props?: CustomStackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;
        
        const appId: string = scope.node.tryGetContext('appId');
        const region = props?.env?.region;
        const destinationBucketRegion = (region !== infrastructureConfig.regions.primary) ? infrastructureConfig.regions.primary : infrastructureConfig.regions.secondary;
        
        const contentBucket = new Bucket(this, 'ServerlessAppContentBucket', {
            bucketName: `${infrastructureConfig.contentBucketName}-${appId}-${region}`,
            versioned: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.KMS,
            encryptionKey: Alias.fromAliasName(this, 'ServerlessAppS3KMSLookup', infrastructureConfig.kmsAlias),
            bucketKeyEnabled: true,
            // removalPolicy: RemovalPolicy.DESTROY // NOTE: for dev only, remove or use 'RETAIN' for actual use
        });

        if (scope.node.tryGetContext('shouldConfigureReplication')) {
            (contentBucket.node.defaultChild as CfnBucket).replicationConfiguration = {
                role: Fn.sub("arn:aws:iam::${AWS::AccountId}:role/service-role/"+`${infrastructureConfig.s3ReplicationRoleName}-${appId}`),
                rules: [
                    {
                        id: `s3-replication-rule-${region}-to-${destinationBucketRegion}`,
                        // priority: 0,
                        // filter: { prefix: '' },
                        status: 'Enabled',
                        // sourceSelectionCriteria: { replicaModifications: { status: 'Enabled' } },
                        prefix: '',
                        destination: {
                            bucket: `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${destinationBucketRegion}`,
                            // replicationTime: { status: 'Enabled', time: { minutes: 15 } },
                            // metrics: { status: 'Enabled', eventThreshold: { minutes: 15 } }
                        },
                        // deleteMarkerReplication: { status: 'Enabled' },
                        // TODO: add kms encryption settings
                    }
                ]
            };
        }
    }
}
