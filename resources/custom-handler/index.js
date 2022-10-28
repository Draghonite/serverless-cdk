const { S3Client, PutBucketReplicationCommand, GetBucketReplicationCommand } = require('@aws-sdk/client-s3');
const uuid = require('uuid');

const now = () => {
    return (new Date()).toISOString();
}

// checks if replication can be set on the bucket -- expects that there are NO existing replication rules -- expects false response
const checkReplicationExists = (context) => {
    console.log(`[${now()} - checkReplicationExists] Checking if replication rules exist on ${context.SourceBucketName}`);
    return new Promise((resolve) => {
        (new S3Client({ region: context.SourceRegion })).send(new GetBucketReplicationCommand({ 
            Bucket: context.SourceBucketName
        })).then(
            (value) => {
                console.log(`[${now()} - checkReplicationExists] Replication is already set on bucket ${context.SourceBucketName}`);
                // NOTE: ignore -- expect 'rejection' as we're only setting replication initially and not overriding
                resolve(true);
            },
            (reason) => {
                if (reason && reason.Code === 'ReplicationConfigurationNotFoundError') {
                    resolve(false);
                } else {
                    console.log(`[${now()} - checkReplicationExists] Unable to get replication settings on bucket ${context.SourceBucketName}`);
                    resolve(true);
                }
            }
        );
    });
}

const addReplication = (context) => {
    return new Promise((resolve) => {
        (new S3Client({ region: context.SourceRegion })).send(new PutBucketReplicationCommand({
            Bucket: context.SourceBucketName,
            ReplicationConfiguration: {
                Role: context.RoleArn,
                Rules: [{
                    ID: `s3-replication-rule-${context.SourceRegion}-to-${context.DestinationRegion}`,
                    Priority: 0,
                    Filter: { Prefix: '' },
                    Status: 'Enabled',
                    SourceSelectionCriteria: {
                        ReplicaModifications: {
                            Status: 'Enabled'
                        }
                    },
                    Destination: {
                        Bucket: context.DestinationBucketArn,
                        ReplicationTime: { Status: 'Enabled', Time: { Minutes: 15 } },
                        Metrics: { Status: 'Enabled', EventThreshold: { Minutes: 15 } }
                    },
                    DeleteMarkerReplication: { Status: 'Enabled' },
                    // ExistingObjectReplication: { Status: 'Enabled' } // NOTE: do NOT use this property as results in 'MalformedXML' error
                }]
            }
        })).then(
            (value) => {
                console.log(`[${now()} - addReplication] Replication is now enabled between buckets ${context.SourceBucketArn} and ${context.DestinationBucketArn}`);
                console.log(value);
                // NOTE: ignore -- expect 'rejection' as we're only setting replication initially
                resolve(true);
            },
            (reason) => {
                console.log(`[${now()} - addReplication] Unable to set replication between buckets ${context.SourceBucketArn} and ${context.DestinationBucketArn}`);
                console.log(reason);
                resolve(false);
            }
        ).catch(err => {
            console.log(`[${now()} - addReplication] Exception ${context.SourceBucketArn} and ${context.DestinationBucketArn}`);
            console.log(err);
        });
    });
}

// orchestrates the process of adding the replication rule to the S3 bucket if none exist
const tryCreateS3Replication = async (context) => {
    console.log(`[${now()} - tryCreateS3Replication]: Started creating replication rule...`);
    const isReplicationExists = await checkReplicationExists(context);
    console.log(`[${now()} - tryCreateS3Replication]: Exists? ${isReplicationExists}`);
    if (!isReplicationExists) {
        console.log(`[${now()} - tryCreateS3Replication]: adding replication rule...`);
        const addReplicationResult = await addReplication(context);
        console.log(`[${now()} - tryCreateS3Replication]: Done creating replication rule`);
        return true;
    } else {
        console.log(`[${now()} - tryCreateS3Replication]: Skipped as the replication rule [${isReplicationExists}] already exists or could not be validated`);
        return false;
    }
}

/* Entry point */
const addS3Replication = async () => {
    let createPrimaryReplicationRoleOptions = {
        RoleArn: process.env.REPLICATION_ROLE_ARN,
        SourceRegion: process.env.PRIMARY_REGION,
        SourceBucketName: `${process.env.BUCKET_NAME}-${process.env.PRIMARY_REGION}`,
        SourceBucketArn: `arn:aws:s3:::${process.env.BUCKET_NAME}-${process.env.PRIMARY_REGION}`,
        DestinationRegion: process.env.SECONDARY_REGION,
        DestinationBucketName: `${process.env.BUCKET_NAME}-${process.env.SECONDARY_REGION}`,
        DestinationBucketArn: `arn:aws:s3:::${process.env.BUCKET_NAME}-${process.env.SECONDARY_REGION}`
    };
    
    console.log(createPrimaryReplicationRoleOptions);
    
    let createSecondaryReplicationRoleOptions = {
        RoleArn: process.env.REPLICATION_ROLE_ARN,
        SourceRegion: process.env.SECONDARY_REGION,
        SourceBucketName: `${process.env.BUCKET_NAME}-${process.env.SECONDARY_REGION}`,
        SourceBucketArn: `arn:aws:s3:::${process.env.BUCKET_NAME}-${process.env.SECONDARY_REGION}`,
        DestinationRegion: process.env.PRIMARY_REGION,
        DestinationBucketName: `${process.env.BUCKET_NAME}-${process.env.PRIMARY_REGION}`,
        DestinationBucketArn: `arn:aws:s3:::${process.env.BUCKET_NAME}-${process.env.PRIMARY_REGION}`
    };
    
    console.log(createSecondaryReplicationRoleOptions);

    // primary -> secondary
    const response1Result = await tryCreateS3Replication(createPrimaryReplicationRoleOptions);
    // secondary -> primary
    const response2Result = await tryCreateS3Replication(createSecondaryReplicationRoleOptions);
    
    return [response1Result, response2Result];
}

exports.handler = async (event) => {
    console.log(event);
    
    switch (event.RequestType) {
        case 'Update':
        case 'Create':
            const addS3ReplicationReponse = await addS3Replication();
            console.log(addS3ReplicationReponse);
            return {
                PhysicalResourceId: uuid.v4()
            };
        case 'Delete':
            return;
        default:
            throw new Error('Unknown request type');
    }
};