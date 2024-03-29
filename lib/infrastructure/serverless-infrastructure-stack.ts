import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { InfrastructureConfig, TagEnum } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, InterfaceVpcEndpoint, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, CfnDBCluster, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, CfnResource, Fn, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal, Effect, IPrincipal, AnyPrincipal, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import { Alias, Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, CfnRecordSet, HostedZone, IAliasRecordTarget, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApplicationListenerRule, ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { AuthorizationType, CfnAuthorizer, DomainName, EndpointType, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { AwsCustomResource, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export class ServerlessInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;
        
        const appId: string = scope.node.tryGetContext('appId');
        const region = props?.env?.region;
        const recordSetName = scope.node.tryGetContext('recordSetName');
        const hostedZoneId = scope.node.tryGetContext('hostedZoneId');
        const hostedZone = HostedZone.fromHostedZoneId(this, 'HostedZoneLookup', hostedZoneId);
        const primaryRegionTrafficWeight = scope.node.tryGetContext('primaryRegionTrafficWeight');
        const secondaryRegionTrafficWeight = scope.node.tryGetContext('secondaryRegionTrafficWeight');
        const certificateDomainName = scope.node.tryGetContext('certificateDomainName');
        const appExecutionRole = Role.fromRoleArn(this, 'ServerlessAppExecutionRoleLookup', `arn:aws:iam::${this.account}:role/service-role/${infrastructureConfig.appExecutionRoleName}-${appId}`, { mutable: false });

        const kmsKey = new Key(this, 'ServerlessAppS3KMS', {
            alias: infrastructureConfig.kmsAlias
        });
        Tags.of(kmsKey).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(kmsKey).add(TagEnum.NAME, `${infrastructureConfig.kmsAlias}-${appId}-${region}-kms`);

        const certificate = new Certificate(this, 'ServerlessCertificate', {
            domainName: certificateDomainName,
            validation: CertificateValidation.fromDns(hostedZone)
        });
        Tags.of(certificate).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(certificate).add(TagEnum.NAME, `${certificateDomainName}-${appId}-${region}-cert`);

        const vpc = new Vpc(this, 'ServerlessVPC', {
            vpcName: infrastructureConfig.vpcName,
            cidr: infrastructureConfig.vpcCIDR,
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: infrastructureConfig.vpcSubnetGroupNames[0],
                    subnetType: SubnetType.PRIVATE_ISOLATED
                },
                {
                    name: infrastructureConfig.vpcSubnetGroupNames[1],
                    subnetType: SubnetType.PRIVATE_ISOLATED
                }
            ]
        });
        Tags.of(vpc).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(vpc).add(TagEnum.NAME, infrastructureConfig.vpcName);

        // TOOD: re-enable app bucket as needed
        // const appBucket = new Bucket(this, 'LambdaAppBucket', {
        //     bucketName: `${infrastructureConfig.appBucketName}-${appId}-${region}`,
        //     versioned: true,
        //     blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        //     encryption: BucketEncryption.KMS,
        //     encryptionKey: Alias.fromAliasName(this, 'ServerlessAppS3KMSLookup', infrastructureConfig.kmsAlias),
        //     bucketKeyEnabled: true
        // });

        // TODO: ensure the lambda function has code for testing database connectivity -- use 'pg' node module and query against a standard sys database, or some other query
        // TODO: add a function for basic heart-beat check: access to db should suffice; return 200: OK
        // const lambdaApp = new lambda.Function(this, 'LambdaAppHandler', {
        //     functionName: infrastructureConfig.appLambdaName,
        //     runtime: lambda.Runtime.NODEJS_16_X,
        //     code: lambda.Code.fromAsset('resources'),
        //     handler: 'widgets.main',
        //     environment: {
        //         BUCKET: appBucket.bucketArn
        //     },
        //     memorySize: 128,
        //     timeout: cdk.Duration.seconds(30),
        //     // vpc: vpc,
        //     // vpcSubnets: {
        //     //     subnetGroupName: infrastructureConfig.appLambdaSubnetGroupName
        //     // }
        // });

        const lambdaApiSecurityGroup = new SecurityGroup(this, 'LambdaApiSG', {
            vpc: vpc,
            allowAllOutbound: true
        });
        lambdaApiSecurityGroup.addIngressRule(
            infrastructureConfig.isInternal ? Peer.ipv4(infrastructureConfig.vpcCIDR) : Peer.anyIpv4(),
            Port.tcp(443)
        );
        Tags.of(lambdaApiSecurityGroup).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(lambdaApiSecurityGroup).add(TagEnum.NAME, `${infrastructureConfig.apiLambdaName}-${appId}-${region}-sg`);

        const lambdaApi = new lambda.Function(this, 'LambdaApiHandler', {
            functionName: `${infrastructureConfig.apiLambdaName}-${appId}-${region}`,
            runtime: lambda.Runtime.NODEJS_16_X,
            code: lambda.Code.fromAsset('resource-api-lambda'),
            handler: 'index.main',
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            vpc: vpc,
            vpcSubnets: {
                subnetGroupName: infrastructureConfig.vpcSubnetGroupNames[0]
            },
            environmentEncryption: kmsKey,
            tracing: infrastructureConfig.xrayTracingEnabled ? Tracing.ACTIVE : Tracing.DISABLED,
            securityGroups: [lambdaApiSecurityGroup],
            environment: {
                BUCKET: `${infrastructureConfig.contentBucketName}-${appId}-${region}`,
                // TODO: configure endpoint for the database
            },
            role: appExecutionRole
        });
        Tags.of(lambdaApi).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(lambdaApi).add(TagEnum.NAME, `${infrastructureConfig.apiLambdaName}-${appId}-${region}-lambda`);

        const lambdaApiAuthorizerSecurityGroup = new SecurityGroup(this, 'LambdaApiAuthorizerSG', {
            vpc: vpc,
            allowAllOutbound: true
        });
        lambdaApiAuthorizerSecurityGroup.addIngressRule(
            infrastructureConfig.isInternal ? Peer.ipv4(infrastructureConfig.vpcCIDR) : Peer.anyIpv4(),
            Port.tcp(443)
        );
        Tags.of(lambdaApiAuthorizerSecurityGroup).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(lambdaApiAuthorizerSecurityGroup).add(TagEnum.NAME, `${infrastructureConfig.apiAuthorizerLambdaName}-${appId}-${region}-sg`);

        const lambdaApiAuthorizer = new lambda.Function(this, 'LambdaApiAuthorizer', {
            functionName: `${infrastructureConfig.apiAuthorizerLambdaName}-${appId}-${region}`,
            runtime: lambda.Runtime.NODEJS_16_X,
            code: lambda.Code.fromAsset('resource-api-authorizer-lambda'),
            handler: 'index.main',
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            vpc: vpc,
            environmentEncryption: kmsKey,
            tracing: infrastructureConfig.xrayTracingEnabled ? Tracing.ACTIVE : Tracing.DISABLED,
            securityGroups: [lambdaApiAuthorizerSecurityGroup],
            environment: {
                JWT_SECRET: infrastructureConfig.jwtTokenSecret,
                LAMBDA_API_ARN: lambdaApi.functionArn,
                S3_CONTENT_ARN: `arn:aws:s3:::${infrastructureConfig.contentBucketName}-${appId}-${region}`
            },
            role: appExecutionRole
        });
        Tags.of(lambdaApiAuthorizer).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(lambdaApiAuthorizer).add(TagEnum.NAME, `${infrastructureConfig.apiAuthorizerLambdaName}-${appId}-${region}-lambda-auth`);

        // TODO: much more to configure to allow {proxy+} integration and OPTIONS under a hierarchy
        // e.g. /v1/{proxy+}/ANY|OPTIONS where ANY and OPTIONS are separate methods 3-level deep
        const restAPI = new apigateway.RestApi(this, 'ServerlessAPI', {
            restApiName: `${infrastructureConfig.restApiName}-${appId}-${region}`,
            description: infrastructureConfig.restApiDescription,
            disableExecuteApiEndpoint: infrastructureConfig.apiExecuteApiEndpointDisabled,
            endpointTypes: [EndpointType.REGIONAL],
            policy: new PolicyDocument({
                statements: [
                    new PolicyStatement({
                        actions: [ 'execute-api:Invoke' ],
                        resources: [ `arn:aws:execute-api:${region}:*:*` ],
                        effect: Effect.ALLOW,
                        principals: [ new AnyPrincipal() ]
                    })
                ]
            }),
            cloudWatchRole: true // TODO: how to configure 'CloudWatch log role ARN' directly -- should be the same as the app execution role
        });
        Tags.of(restAPI).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(restAPI).add(TagEnum.NAME, `${infrastructureConfig.restApiName}-${appId}-${region}-apigw-api`);

        const restAPIAuthorizer = new CfnAuthorizer(this, 'ServerlessAPIAuthorizer', {
            name: `${infrastructureConfig.apiAuthorizerName}-${appId}-${region}`,
            restApiId: restAPI.restApiId,
            type: 'TOKEN',
            identitySource: 'method.request.header.Authorization',
            identityValidationExpression: '^Bearer .+',
            authorizerUri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${lambdaApiAuthorizer.functionArn}/invocations`,
            authorizerResultTtlInSeconds: infrastructureConfig.apiAuthorizerTTL,
            authorizerCredentials: `arn:aws:iam::${this.account}:role/service-role/${infrastructureConfig.apiAuthorizerRoleName}-${appId}`
        });
        Tags.of(restAPIAuthorizer).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(restAPIAuthorizer).add(TagEnum.NAME, `${infrastructureConfig.apiAuthorizerName}-${appId}-${region}-apigw-auth`);

        const restAPIAuthorizerGetMethod = restAPI.root.addMethod('GET', new apigateway.LambdaIntegration(lambdaApi, {
            requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
        }), {
            authorizationType: AuthorizationType.CUSTOM
        });

        const resource = restAPIAuthorizerGetMethod.node.findChild('Resource');
        (resource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (resource as CfnResource).addPropertyOverride('AuthorizerId', { Ref: restAPIAuthorizer.logicalId });

        const apiDomain = new DomainName(this, 'ServerlessAPIDomain', {
            certificate: certificate,
            domainName: recordSetName,
            basePath: '/'
        });
        apiDomain.addBasePathMapping(restAPI, {
            basePath: infrastructureConfig.cdnApiBasePath
        });
        // TODO: add base path for /app
        Tags.of(apiDomain).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(apiDomain).add(TagEnum.NAME, `${recordSetName}-${appId}-${region}-apigw-cdn`);

        const recordSet = new CfnRecordSet(this, 'RecordSet', {
            name: recordSetName,
            type: 'A',
            hostedZoneId: hostedZoneId,
            aliasTarget: {
                dnsName: apiDomain.domainNameAliasDomainName,
                hostedZoneId: apiDomain.domainNameAliasHostedZoneId,
                evaluateTargetHealth: false
            },
            setIdentifier: `${region}-record`,
            weight: region === infrastructureConfig.regions.primary ? +primaryRegionTrafficWeight : +secondaryRegionTrafficWeight
        });
        Tags.of(recordSet).add(TagEnum.APPLICATION_ID, appId);

        const dbSubnetGroup = new SubnetGroup(this, 'ServerlessDbSubnetGroup', {
            vpc: vpc,
            subnetGroupName: infrastructureConfig.databaseSubnetGroupName,
            description: infrastructureConfig.databaseSubnetGroupDescription,
            vpcSubnets: {
                onePerAz: true,
                subnetGroupName: infrastructureConfig.vpcSubnetGroupNames[1]
            },
            removalPolicy: infrastructureConfig.isDevTesting ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
        });
        Tags.of(dbSubnetGroup).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(dbSubnetGroup).add(TagEnum.NAME, `${infrastructureConfig.databaseSubnetGroupName}-${appId}-${region}`);

        // #region RDS

        // NOTE: only deploying primary cluster -- need a different approach for multi-region read replica, keeps faling w/ known 'username' issue
        if (region === infrastructureConfig.regions.primary) {
            const dbSecurityGroup = new SecurityGroup(this, 'RDSSG', {
                vpc: vpc,
                allowAllOutbound: true
            });
            dbSecurityGroup.applyRemovalPolicy(infrastructureConfig.isDevTesting ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN);
            dbSecurityGroup.addIngressRule(
                // NOTE: for added security, can allow ONLY connections from the lambda security group
                infrastructureConfig.isInternal ? Peer.ipv4(infrastructureConfig.vpcCIDR) : Peer.anyIpv4(),
                Port.tcp(5432)
            );
            Tags.of(dbSecurityGroup).add(TagEnum.APPLICATION_ID, appId);
            Tags.of(dbSecurityGroup).add(TagEnum.NAME, `${infrastructureConfig.appName}-${appId}-${region}-rds-sg`);

            const dbCredentialSecrets = new Secret(this, 'ServerlessDbSecrets', {
                secretName: `${infrastructureConfig.databaseClusterName}-credentials`,
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({
                        username: infrastructureConfig.databaseName
                    }),
                    excludePunctuation: true,
                    includeSpace: false,
                    generateStringKey: 'password'
                }
            });
            Tags.of(dbCredentialSecrets).add(TagEnum.APPLICATION_ID, appId);
            Tags.of(dbCredentialSecrets).add(TagEnum.NAME, `${infrastructureConfig.databaseClusterName}-${appId}-${region}-credentials`);

            const dbEngine = DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_7 });

            const rdsCluster = new DatabaseCluster(this, 'ServerlessDbCluster', {
                defaultDatabaseName: (region === infrastructureConfig.regions.primary) ? infrastructureConfig.databaseName : undefined,
                engine: dbEngine,
                parameterGroup: ParameterGroup.fromParameterGroupName(this, 'ServerlessDbParameterGroup', infrastructureConfig.databaseParameterGroupName),
                instanceProps: {
                    instanceType: InstanceType.of(InstanceClass.R5, InstanceSize.LARGE),
                    vpc: vpc,
                    vpcSubnets: {
                        subnetGroupName: infrastructureConfig.vpcSubnetGroupNames[1]
                    },
                    publiclyAccessible: !infrastructureConfig.isInternal,
                    securityGroups: [dbSecurityGroup]
                },
                clusterIdentifier: `${infrastructureConfig.databaseClusterName}-${appId}-${region}`,
                removalPolicy: infrastructureConfig.isDevTesting ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
                storageEncryptionKey: kmsKey,
                credentials: (region === infrastructureConfig.regions.primary) ? {
                    username: infrastructureConfig.databaseUsername,
                    password: dbCredentialSecrets.secretValueFromJson('password')
                } : undefined,
                subnetGroup: dbSubnetGroup
            });
            const cfnRdsCluster = (rdsCluster.node.defaultChild as CfnDBCluster);
            cfnRdsCluster.globalClusterIdentifier = `${infrastructureConfig.globalDatabaseClusterName}-${appId}`;
            // TODO: create the database monitoring role so it's not created automatically -- replicate 'AWSServiceRoleForRDS' role
            // cfnRdsCluster.monitoringRoleArn = ``;

            Tags.of(rdsCluster).add(TagEnum.APPLICATION_ID, appId);
            Tags.of(rdsCluster).add(TagEnum.NAME, `${infrastructureConfig.databaseName}-${appId}-${region}-db`);
        }

        // #endregion

        // TODO: ensure traceability through x-ray; ideally make tracing optional (configurable, all-or-nothing)

        new CfnOutput(this, 'ServerlessAppURL', {
            exportName: 'ApplicationEntryPoint',
            value: `https://${apiDomain.domainName}/api/`
        });
    }
}
