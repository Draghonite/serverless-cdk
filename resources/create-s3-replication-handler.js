exports.handler = async (event) => {
    console.log('[handler called]');
    console.log(event);

    const AWS = require('aws-sdk');
    const uuidv4 = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(x){var n=16*Math.random()|0;return("x"==x?n:3&n|8).toString(16)});
                    
    const tryCreateS3Replication = (context) => {
        const s3 = new AWS.S3({ region: context.primaryRegion });
        return new Promise((resolve, reject) => {
            s3.getBucketReplication({ Bucket: context.SourceBucketName }, (error1) => {
                if (!error1 || error1.code !== 'ReplicationConfigurationNotFoundError') { reject(); } else {
                    s3.putBucketReplication({
                        Bucket: context.SourceBucketName,
                        // TODO: enure to include replication of kms-encrypted objects by setting the appropriate options -- https://sbstjn.com/blog/aws-cdk-s3-cross-region-replication-kms/
                        ReplicationConfiguration: {
                            Role: context.RoleArn,
                            Rules: [{
                                ID: 's3-replication-rule-'+context.SourceRegion+'-to-'+context.DestinationRegion,
                                Priority: 0,
                                Filter: { Prefix: '' },
                                Status: 'Enabled',
                                SourceSelectionCriteria: { ReplicaModifications: { Status: 'Enabled' } },
                                Destination: {
                                    Bucket: context.DestinationBucketArn,
                                    ReplicationTime: { Status: 'Enabled', Time: { Minutes: 15 } },
                                    Metrics: { Status: 'Enabled', EventThreshold: { Minutes: 15 } }
                                },
                                DeleteMarkerReplication: { Status: 'Enabled' }
                            }]
                        }
                    }, () => resolve());
                }
            });
        });
    }

    switch (event.RequestType) {
        case 'Update':
        case 'Create':
            await tryCreateS3Replication({
                RoleArn: process.env.REPLICATION_ROLE_ARN,
                SourceRegion: process.env.SECONDARY_REGION,
                SourceBucketName: process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                SourceBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                DestinationRegion: process.env.PRIMARY_REGION,
                DestinationBucketName: process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                DestinationBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION
            });
            await tryCreateS3Replication({
                RoleArn: process.env.REPLICATION_ROLE_ARN,
                SourceRegion: process.env.PRIMARY_REGION,
                SourceBucketName: process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                SourceBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.PRIMARY_REGION,
                DestinationRegion: process.env.SECONDARY_REGION,
                DestinationBucketName: process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION,
                DestinationBucketArn: 'arn:aws:s3:::'+process.env.BUCKET_NAME+'-'+process.env.SECONDARY_REGION
            });
            return { PhysicalResourceId: uuidv4() };
        case 'Delete':
            return;
        default:
            throw new Error('Unknown request type');
    }
};