const AWS_IAM = require('@aws-sdk/client-iam');
const AWS_S3 = require('@aws-sdk/client-s3');
const iam = new AWS_IAM.IAM();
const uuid = require('uuid');

/*
    Tokens: 
     - {sourceBucketArn}
     - {sourceRegion}
     - {destinationRegion}
*/
const replicationPolicyStatementNoKMS = {
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
     - {account}
*/
const replicationPolicyStatementWithKMS = [
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
];

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

// checks if the role exists; run success callback if it doesn't
const checkRoleExists = (context) => {
    return new Promise(
        (resolve, reject) => {
            iam.getRole({ RoleName: context.RoleName })
                .catch((result) => {
                    if (result && result.Error && result.Error.Code === 'NoSuchEntity') {
                        resolve(false);
                    } else {
                        console.log(`Unable to get information about role ${context.RoleName}`);
                    }
                })
                // .then(
                //     () => console.log(`Role ${context.RoleName} already exists`),
                //     () => console.log(`Unable to get information about role ${context.RoleName}`)
                // );
        }
    );
}

// create the role
const createRole = (context) => {
    return new Promise((resolve, reject) => {
        iam.createRole({
            RoleName: context.RoleName,
            Description: 'Role used for cross-region S3 replication for a specific bucket',
            Path: '/service-role/',
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
                    console.log(`[createRole]: Created role ${context.RoleName}`);
                    context.RoleArn = value.Role.Arn;
                    context.RoleName = value.Role.RoleName;
                    resolve(context);
                }
            },
            (reason) => {
                console.log('[createRole] Failed to create role', JSON.stringify(reason));
            }
        )
    });
}

const addReplicationRolePolicy = (context) => {
    const replicationPolicy = context.useKMS && context.Account ? replicationPolicyStatementWithKMS : replicationPolicyStatementNoKMS;
    let policyDocument = JSON.stringify(replicationPolicy)
        .replace(/\{sourceBucketArn\}/g, context.SourceBucketArn)
        .replace(/\{sourceRegion\}/g, context.SourceRegion)
        .replace(/\{destinationBucketArn\}/g, context.DestinationBucketArn)
        .replace(/\{destinationRegion\}/g, context.DestinationRegion)
        .replace(/\{account\}/g, context.Account);
    return new Promise((resolve, reject) => {
        iam.createPolicy({ PolicyName: `${context.RoleName}-${getUniqueId(true)}`, PolicyDocument: policyDocument }).then(
            (value) => {
                if (value && value.Policy && value.Policy.Arn) {
                    context.PolicyName = value.Policy.PolicyName;
                    context.PolicyArn = value.Policy.Arn;
                    console.log(`[addRolePolicies]: Created policy ${context.PolicyName}`);
                    resolve(context);
                }
            },
            (reason) => {
                console.log(`[addRolePolicies]: Failed to create policy for role ${context.RoleName}`);
                console.log(reason);
            }
        )
    });
}

const addPolicyToRole = (context) => {
    return new Promise((resolve, reject) => {
        iam.attachRolePolicy({ RoleName: context.RoleName, PolicyArn: context.PolicyArn }).then(
            (value) => {
                console.log(`[addPolicyToRole]: Added policy to role ${context.RoleName}`);
                resolve(context);
            },
            (reason) => {
                console.log(`[addPolicyToRole]: Failed to add policy to role ${context.RoleName}`);
                console.log(reason);
            }
        )
    });
}

// checks if replication can be set on the bucket
const checkReplicationExists = (context) => {
    return new Promise((resolve, reject) => {
        (new AWS_S3.S3({ region: context.primaryRegion })).getBucketReplication({ Bucket: context.SourceBucketName })
            .then(
                (value) => {
                    console.log(`Replication is already set on bucket ${context.SourceBucketName}`);
                    // NOTE: ignore -- expect 'rejection' as we're only setting replication initially
                    resolve(false);
                },
                (reason) => {
                    if (reason && reason.Code === 'ReplicationConfigurationNotFoundError') {
                        resolve(true);
                    } else {
                        console.log(`Unable to get replication settings on bucket ${context.SourceBucketName}`);
                        resolve(false);
                    }
                }
            );
    });
}

// TODO: resolve Error: Invalid ARN {bucket-arn} was an invalid ARN
const addReplication = (context) => {
    return new Promise((resolve, reject) => {
        (new AWS_S3.S3({ region: context.primaryRegion })).putBucketReplication({
            Bucket: context.SourceBucketArn,
            ReplicationConfiguration: {
                Role: context.RoleArn,
                Rules: [{
                    Status: 'Enabled',
                    Priority: 1,
                    DeleteMarkerReplication: { Status: 'Enabled' },
                    Filter: { Prefix: '' },
                    Destination: {
                        Bucket: context.DestinationBucketArn,
                        ReplicationTime: { Time: { Minutes: 15 }, Status: 'Enabled' }
                    }
                }]
            }
        }).then(
            (value) => {
                console.log(`Replication is now enabled between buckets ${context.SourceBucketArn} and ${context.DestinationBucketArn}`);
                console.log(value);
                // NOTE: ignore -- expect 'rejection' as we're only setting replication initially
                resolve(true);
            },
            (reason) => {
                console.log(`Unable to set replication between buckets ${context.SourceBucketArn} and ${context.DestinationBucketArn}`);
                console.log(reason);
                resolve(false);
            }
        );
    });
}

// orchestrates the process
const tryCreateS3Replication = async (context) => {
    const isRoleExists = await checkRoleExists(context);
    if (!isRoleExists) {
        const createRoleResult = await createRole(context);
        const addReplicationRolePolicyResult = await addReplicationRolePolicy(context);
        const addPolicyToRoleResult = await addPolicyToRole(context);
        const isReplicationExists = await checkReplicationExists(context);
        if (!isReplicationExists) {
            const addReplicationResult = await addReplication(context);
        }
        console.log('[tryCreateS3Replication]: Done', JSON.stringify(context));
    }
}


/* Entry point */
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