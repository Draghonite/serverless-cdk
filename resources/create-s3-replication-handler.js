exports.handler = (event, context) => {
    console.log('[handler called]');
    console.log(event);

    var response = require('cfn-response');
    const AWS = require('aws-sdk');
                    
    const tryCreateS3Replication = (options) => {
        const s3 = new AWS.S3({ region: options.primaryRegion });
        return new Promise((resolve) => {
            s3.getBucketReplication({ Bucket: options.SourceBucketName }, (error, result) => {
                const isRuleExists = result?.Rules?.filter(r => r.ID === 's3-replication-rule-'+options.SourceRegion+'-to-'+options.DestinationRegion).length > 0;
                console.log('[tryCreateS3Replication]', 'error: ', error, 'result: ', JSON.stringify(result));
                
                // TODO: something about this?!
                // if (!isRuleExists && (!error || error.code === 'ReplicationConfigurationNotFoundError')) {
                    s3.putBucketReplication({
                        Bucket: options.SourceBucketName,
                        ReplicationConfiguration: {
                            Role: options.RoleArn,
                            Rules: [{
                                ID: 's3-replication-rule-'+options.SourceRegion+'-to-'+options.DestinationRegion,
                                Priority: 0,
                                Filter: { Prefix: '' },
                                Status: 'Enabled',
                                SourceSelectionCriteria: { 
                                    ReplicaModifications: { Status: 'Enabled' },
                                    SseKmsEncryptedObjects: { Status: 'Enabled' }
                                },
                                Destination: {
                                    Bucket: options.DestinationBucketArn,
                                    ReplicationTime: { Status: 'Enabled', Time: { Minutes: 15 } },
                                    Metrics: { Status: 'Enabled', EventThreshold: { Minutes: 15 } },
                                    EncryptionConfiguration: { ReplicaKmsKeyID: options.DestinationKmsKeyArn }
                                },
                                DeleteMarkerReplication: { Status: 'Enabled' }
                            }]
                        }
                    }, () => resolve());
                // } else { resolve(); }
            });
        });
    }

    switch (event.RequestType) {
        case 'Update':
        case 'Create':
            const accountId = process.env.ACCOUNT || context.invokedFunctionArn.split(':')[4];
            Promise.all([
                tryCreateS3Replication({
                    RoleArn: process.env.REPLICATION_ROLE_ARN,
                    SourceRegion: process.env.SECONDARY_REGION,
                    SourceBucketName: process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                    SourceBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                    SourceKmsKeyArn: 'arn:aws:kms:'+process.env.SECONDARY_REGION+':'+accountId+':'+process.env.KMS_KEY_ALIAS,
                    DestinationRegion: process.env.PRIMARY_REGION,
                    DestinationBucketName: process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                    DestinationBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                    DestinationKmsKeyArn: 'arn:aws:kms:'+process.env.PRIMARY_REGION+':'+accountId+':'+process.env.KMS_KEY_ALIAS
                }),
                tryCreateS3Replication({
                    RoleArn: process.env.REPLICATION_ROLE_ARN,
                    SourceRegion: process.env.PRIMARY_REGION,
                    SourceBucketName: process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                    SourceBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                    SourceKmsKeyArn: 'arn:aws:kms:'+process.env.PRIMARY_REGION+':'+accountId+':'+process.env.KMS_KEY_ALIAS,
                    DestinationRegion: process.env.SECONDARY_REGION,
                    DestinationBucketName: process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                    DestinationBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                    DestinationKmsKeyArn: 'arn:aws:kms:'+process.env.SECONDARY_REGION+':'+accountId+':'+process.env.KMS_KEY_ALIAS
                })
            ]).then(() => {
                response.send(event, context, response.SUCCESS);
            });
            break;
        case 'Delete':
            response.send(event, context, response.SUCCESS);
            break;
        default:
            response.send(event, context, response.FAILED, { message: 'Unknown request type.' });
            break;
    }
};