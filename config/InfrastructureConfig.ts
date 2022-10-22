export const InfrastructureConfig = {
    vpcName: 'serverless-vpc',
    vpcCIDR: '10.0.0.0/24',
    vpcIdOutput: 'ServerlessVPCId',
    restApiName: 'Serverless API',
    restApiDescription: 'API that provides an access point for the application',
    apiBucketName: 'serverless-api',
    appBucketName: 'serverless-app',
    appBucketArnOutput: 'ServerlessAppBucketArn',
    appBucketNameOutput: 'ServerlessAppBucketName',
    appBucketMultiRegionAccessPointName: 'serverless-app-mrap',
    appLambdaName: 'serverless-app',
    isS3ReplicationEnabled: true,
    isS3ReplicationMetricsEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-metrics.html
    isS3ReplicationTimeEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-time-control.html // NOTE: in the UI, replicationTime, if enabled, makes metrics automatically enabled and prevents from being disabled -- this is accounted for in code
    isS3ReplicationDeleteMarkerEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/delete-marker-replication.html
    isS3ReplicationModificationsEnabled: true, // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-for-metadata-changes.html
    // availabilityZones: 3,
    globalDatabaseClusterName: 'global-serverless-db-cluster',
    databaseParameterGroupName: 'default.aurora-postgresql13',
    databaseSubnetGroupName: 'serverless-db-subnet-group',
    databaseSubnetGroupDescription: 'Database subnet group',
    databaseClusterName: 'severless-db-cluster',
    databaseName: 'serverless'
}