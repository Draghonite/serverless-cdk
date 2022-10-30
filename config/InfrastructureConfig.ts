export const InfrastructureConfig = {
    vpcName: 'serverless-vpc',
    vpcCIDR: '10.0.0.0/24',
    vpcIdOutput: 'ServerlessVPCId',
    vpcSubnetGroupNames: [
        'PrivateSubnetLambda1','PrivateSubnetRDS1','PrivateSubnetRDS'
    ],
    restApiName: 'Serverless API',
    restApiDescription: 'API that provides an access point for the application',
    apiBucketName: 'serverless-api',
    appBucketName: 'serverless-app',
    appBucketArnOutput: 'ServerlessAppBucketArn',
    appBucketNameOutput: 'ServerlessAppBucketName',
    appBucketMultiRegionAccessPointName: 'serverless-app-mrap',
    appLambdaName: 'serverless-app',
    appLambdaSubnetGroupName: 'PrivateSubnetLambda',
    lambdaCustomHandlerName: 'serverless-app-lambda-provider',
    lambdaCustomHandlerArnOutput: 'CustomLambdaReplicationHandlerArnOutput',
    s3ReplicationRoleName: 'serverless_app_s3_replication_role',
    isS3ReplicationEnabled: true,
    isS3ReplicationMetricsEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-metrics.html
    isS3ReplicationTimeEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-time-control.html // NOTE: in the UI, replicationTime, if enabled, makes metrics automatically enabled and prevents from being disabled -- this is accounted for in code
    isS3ReplicationDeleteMarkerEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/delete-marker-replication.html
    isS3ReplicationModificationsEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-for-metadata-changes.html
    dnsZoneName: 'serverlessapp{uid}.com',
    dnsZoneOutput: 'ServerlessHostedZoneUrl',
    // availabilityZones: 3,
    globalDatabaseClusterName: 'global-serverless-db-cluster',
    databaseParameterGroupName: 'default.aurora-postgresql13',
    databaseSubnetGroupName: 'serverless-db-subnet-group',
    databaseSubnetGroupDescription: 'Database subnet group',
    databaseClusterName: 'severless-db-cluster',
    databaseName: 'serverless',
    regions: {
        primary: 'us-west-1',
        secondary: 'us-west-2'
    }
}