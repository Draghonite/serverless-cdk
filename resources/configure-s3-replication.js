const AWS_IAM = require('@aws-sdk/client-iam');
const { S3Client, PutBucketReplicationCommand } = require('@aws-sdk/client-s3');
const AWS_S3 = require('@aws-sdk/client-s3');
const iam = new AWS_IAM.IAM();
const uuid = require('uuid');

/*
    Tokens: 
     - {sourceBucketArn}
     - {destinationBucketArn}
*/
const replicationRolePolicyDocumentNoKMS = {
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
                "{sourceBucketArn}",
                "{sourceBucketArn}/*"
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
            "Resource": [
                "{destinationBucketArn}/*"
            ]
        }
    ]
};
/*
    Tokens:
     - {sourceBucketArn}
     - {sourceRegion}
     - {destinationRegion}
     - {destinationBucketArn}
     - {account}
*/
const replicationRolePolicyDocumentWithKMS = {
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
                "{sourceBucketArn}",
                "{sourceBucketArn}/*"
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
                "{destinationBucketArn}/*"
            ]
        },
        {
            "Action": [
                "kms:Decrypt"
            ],
            "Effect": "Allow",
            "Condition": {
                "StringLike": {
                    "kms:ViaService": "s3.{sourceRegion}.amazonaws.com",
                    "kms:EncryptionContext:aws:s3:arn": [
                        "{sourceBucketArn}/*"
                    ]
                }
            },
            "Resource": [
                "arn:aws:kms:{sourceRegion}:{account}:alias/aws/s3"
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
                        "s3.{destinationRegion}.amazonaws.com"
                    ],
                    "kms:EncryptionContext:aws:s3:arn": [
                        "{destinationBucketArn}/*"
                    ]
                }
            },
            "Resource": [
                "arn:aws:kms:{destinationRegion}:{account}:alias/aws/s3"
            ]
        }
    ]
};

const getUniqueId = (isShort = false) => {
    if (isShort) {
        let shortId = Math.random().toString(36);
        if (shortId.includes('0.')) {
            shortId = shortId.split('0.')[1];
        }
        return shortId;
    } else {
        return uuid.v4();
    }
}

const trimLength = (input, length) => {
    if (!input) { return ''; }
    return input.substring(0, length);
}

const now = () => {
    return (new Date()).toISOString();
}

// checks if the role exists; run success callback if it doesn't
const checkRoleExists = (context) => {
    return new Promise(
        (resolve) => {
            iam.getRole({ RoleName: context.RoleName })
                .catch((result) => {
                    if (result && result.Error && result.Error.Code === 'NoSuchEntity') {
                        resolve(false);
                    } else {
                        console.log(`[${now()} - checkRoleExists]: Unable to get information about role ${context.RoleName}`);
                    }
                })
        }
    );
}

// create the role
const createRole = (context) => {
    return new Promise((resolve) => {
        iam.createRole({
            RoleName: context.RoleName,
            Description: 'Role used for cross-region S3 replication for a specific bucket',
            // Path: '/service-role/',
            AssumeRolePolicyDocument: JSON.stringify({
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "s3.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            })
        }).then(
            (value) => {
                if (value && value.Role && value.Role.Arn) {
                    console.log(`[${now()} - createRole]: Created role ${context.RoleName}`);
                    context.RoleArn = value.Role.Arn;
                    context.RoleName = value.Role.RoleName;
                    resolve(context);
                }
            },
            (reason) => {
                console.log('[${now()} - createRole] Failed to create role', JSON.stringify(reason));
            }
        )
    });
}

const addReplicationRolePolicy = (context) => {
    const replicationPolicy = context.UseKMS && context.Account ? replicationRolePolicyDocumentWithKMS : replicationRolePolicyDocumentNoKMS;
    let policyDocument = JSON.stringify(replicationPolicy)
        .replace(/\{sourceBucketArn\}/g, context.SourceBucketArn)
        .replace(/\{sourceRegion\}/g, context.SourceRegion)
        .replace(/\{destinationBucketArn\}/g, context.DestinationBucketArn)
        .replace(/\{destinationRegion\}/g, context.DestinationRegion)
        .replace(/\{account\}/g, context.Account);
    return new Promise((resolve) => {
        iam.createPolicy({ PolicyName: `${context.RoleName}-${getUniqueId(true)}`, PolicyDocument: policyDocument }).then(
            (value) => {
                if (value && value.Policy && value.Policy.Arn) {
                    context.PolicyName = value.Policy.PolicyName;
                    context.PolicyArn = value.Policy.Arn;
                    console.log(`[${now()} - addReplicationRolePolicy]: Created policy ${context.PolicyName}`);
                    resolve(context);
                }
            },
            (reason) => {
                console.log(`[${now()} - addReplicationRolePolicy]: Failed to create policy for role ${context.RoleName}`);
                console.log(reason);
            }
        )
    });
}

const addPolicyToRole = (context) => {
    return new Promise((resolve) => {
        iam.attachRolePolicy({ RoleName: context.RoleName, PolicyArn: context.PolicyArn }).then(
            (value) => {
                console.log(`[${now()} - addPolicyToRole]: Added policy to role ${context.RoleName}`);
                resolve(context);
            },
            (reason) => {
                console.log(`[${now()} - addPolicyToRole]: Failed to add policy to role ${context.RoleName}`);
                console.log(reason);
            }
        )
    });
}

// checks if replication can be set on the bucket
const checkReplicationExists = (context) => {
    return new Promise((resolve) => {
        (new AWS_S3.S3({ region: context.SourceRegion })).getBucketReplication({ Bucket: context.SourceBucketName })
            .then(
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
                    ID: `s3-replication-rule-${getUniqueId(true)}`,
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
        );
    });
}

// orchestrates the process
const tryCreateS3Replication = async (context) => {
    const isReplicationExists = await checkReplicationExists(context);
    const isRoleExists = await checkRoleExists(context);
    if (!isReplicationExists && !isRoleExists) {
        const createRoleResult = await createRole(context);
        const addReplicationRolePolicyResult = await addReplicationRolePolicy(context);
        const addPolicyToRoleResult = await addPolicyToRole(context);
        const addReplicationResult = await addReplication(context);
    } else {
        console.log(`[${now()} - tryCreateS3Replication]: Skipped as either role [${!isRoleExists}] and/or replication rule [${isReplicationExists}] already exist`);
    }
    console.log('[${now()} - tryCreateS3Replication]: Done', JSON.stringify(context));
}


/* Entry point */
/*
    To Use: from a command line, execute a one-liner similar as below and with appropriate parameters 
    (substitute values and {uid} accordingly).
        node ./configure-s3-replication.js 
            primaryRegion=us-west-1 
            secondaryRegion=us-west-2 
            primaryBucketName=serverless-app-us-west-1-{uuid}
            secondaryBucketName=serverless-app-us-west-2-{uuid}
            roleName=serverless-app-role-{uid}
*/
const params = new Map();
try {
    (process.argv.slice(2) || []).forEach(arg => {
        let parts = arg.split('=');
        params.set(parts[0], parts[1]);
    });
} catch(ex) {}

console.log(params);

const account = params.get('account');
const roleName = params.get('roleName');
const primaryBucketName = params.get('primaryBucketName');
const primaryRegion = params.get('primaryRegion');
const secondaryBucketName = params.get('secondaryBucketName');
const secondaryRegion = params.get('secondaryRegion');
const useKMS = /true/.test(params.get('useKMS'));

let createPrimaryReplicationRoleOptions = {
    RoleName: trimLength(`${roleName}-${primaryRegion}`, 50),
    SourceRegion: primaryRegion,
    SourceBucketName: primaryBucketName,
    SourceBucketArn: `arn:aws:s3:::${primaryBucketName}`,
    DestinationRegion: secondaryRegion,
    DestinationBucketName: secondaryBucketName,
    DestinationBucketArn: `arn:aws:s3:::${secondaryBucketName}`,
    UseKMS: useKMS,
    Account: account
};

console.log(createPrimaryReplicationRoleOptions);

let createSecondaryReplicationRoleOptions = {
    RoleName: trimLength(`${roleName}-${secondaryRegion}`, 50),
    SourceRegion: secondaryRegion,
    SourceBucketName: secondaryBucketName,
    SourceBucketArn: `arn:aws:s3:::${secondaryBucketName}`,
    DestinationRegion: primaryRegion,
    DestinationBucketName: primaryBucketName,
    DestinationBucketArn: `arn:aws:s3:::${primaryBucketName}`,
    UseKMS: useKMS,
    Account: account
};

console.log(createSecondaryReplicationRoleOptions);

// primary -> secondary
tryCreateS3Replication(createPrimaryReplicationRoleOptions);
// secondary -> primary
tryCreateS3Replication(createSecondaryReplicationRoleOptions);