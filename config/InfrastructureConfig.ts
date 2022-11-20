export const InfrastructureConfig = {
    appId: '',
    vpcName: 'serverless-vpc',
    vpcCIDR: '10.0.0.0/24',
    vpcIdOutput: 'ServerlessVPCId',
    vpcSubnetGroupNames: [
        'PrivateSubnetLambda','PrivateSubnetRDS'
    ],
    kmsAlias: 'alias/serverlessappkey',
    restApiName: 'Serverless API',
    restApiDescription: 'API that provides an access point for the application',
    cdnBasePath: 'cdn',
    cdnApiBasePath: 'api',
    // apiBucketName: 'serverless-api',
    // appBucketName: 'serverless-app',
    // appBucketArnOutput: 'ServerlessAppBucketArn',
    // appBucketNameOutput: 'ServerlessAppBucketName',
    contentBucketName: 'serverless-content',
    appLambdaName: 'serverless-app',
    apiLambdaName: 'serverless-api',
    apiAuthorizerName: 'serverless-api-authorizer',
    apiAuthorizerTTL: 5, // TODO: increase to default (300) or appropriate
    apiAuthorizerLambdaName: 'serverless-api-authorizer',
    apiAuthorizerRoleName: 'serverless_api_authorizer_role',
    apiExecuteApiEndpointDisabled: false, // TODO: consider disabling (true) if not needed once exposed via ALB; can also make configurable
    appLambdaSubnetGroupName: 'PrivateSubnetLambda',
    lambdaCustomHandlerName: 'serverless-app-lambda-provider',
    // lambdaCustomHandlerArnOutput: 'CustomLambdaReplicationHandlerArnOutput',
    s3ReplicationRoleName: 'serverless_app_s3_replication_role',
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
    },
    primaryRegionTrafficWeight: 100,
    secondaryRegionTrafficWeight: 0,
    loadBalancerName: 'serverless-alb',
    // TODO: parameterize or more securely store as a secret, but DO NOT use as-is (esp. production)
    jwtTokenSecret: 'qwertyuiopasdfghjklzxcvbnm123456',
    xrayTracingEnabled: true
}