import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Fn } from 'aws-cdk-lib';
import { Alias } from 'aws-cdk-lib/aws-kms';

export class ServerlessInfrastructureContentBucketStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
            bucketKeyEnabled: true
        });

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
                                replicaKmsKeyId: Fn.sub(`arn:aws:kms:${destinationBucketRegion}`+':${AWS::AccountId}:'+`${infrastructureConfig.kmsAlias}`)
                            }
                        },
                        sourceSelectionCriteria: {
                            sseKmsEncryptedObjects: { status: 'Enabled' }
                        }
                    }
                ]
            };
        }
    }
}
