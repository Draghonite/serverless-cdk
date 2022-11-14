export const InfrastructureConfig = {
    appId: '',
    vpcName: 'serverless-vpc',
    vpcCIDR: '10.0.0.0/24',
    vpcIdOutput: 'ServerlessVPCId',
    vpcSubnetGroupNames: [
        'PrivateSubnetLambda1','PrivateSubnetRDS1','PrivateSubnetRDS'
    ],
    kmsAlias: 'alias/serverlessappkey',
    restApiName: 'Serverless API',
    restApiDescription: 'API that provides an access point for the application',
    // apiBucketName: 'serverless-api',
    appBucketName: 'serverless-app',
    appBucketArnOutput: 'ServerlessAppBucketArn',
    appBucketNameOutput: 'ServerlessAppBucketName',
    contentBucketName: 'serverless-content',
    appLambdaName: 'serverless-app',
    appLambdaSubnetGroupName: 'PrivateSubnetLambda',
    lambdaCustomHandlerName: 'serverless-app-lambda-provider',
    lambdaCustomHandlerArnOutput: 'CustomLambdaReplicationHandlerArnOutput',
    s3ReplicationRoleName: 'serverless_app_s3_replication_role',
    dnsZoneName: 'serverlessapp{appId}.com',
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