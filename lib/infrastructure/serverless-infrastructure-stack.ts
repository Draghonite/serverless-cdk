import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { InfrastructureConfig, TagEnum } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, InterfaceVpcEndpoint, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { BlockPublicAccess, Bucket, BucketEncryption, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, CfnResource, Fn, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal, Effect, IPrincipal, AnyPrincipal, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import { Alias, Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, CfnRecordSet, HostedZone, IAliasRecordTarget, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApplicationListenerRule, ApplicationLoadBalancer, ApplicationTargetGroup, ListenerAction, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { AuthorizationType, CfnAuthorizer, DomainName, EndpointType, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { AwsCustomResource, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

export class ServerlessInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;
        
        const appId: string = scope.node.tryGetContext('appId');
        const region = props?.env?.region;
        const recordSetName = scope.node.tryGetContext('recordSetName');
        const hostedZoneId = scope.node.tryGetContext('hostedZoneId');
        const primaryRegionTrafficWeight = scope.node.tryGetContext('primaryRegionTrafficWeight');
        const secondaryRegionTrafficWeight = scope.node.tryGetContext('secondaryRegionTrafficWeight');
        const certificateDomainName = scope.node.tryGetContext('certificateDomainName');

        const kmsKey = new Key(this, 'ServerlessAppS3KMS', {
            alias: infrastructureConfig.kmsAlias
        });
        Tags.of(kmsKey).add(TagEnum.APPLICATION_ID, appId);

        const hostedZone = HostedZone.fromHostedZoneId(this, 'HostedZoneLookup', hostedZoneId);

        const certificate = new Certificate(this, 'ServerlessCertificate', {
            domainName: certificateDomainName,
            validation: CertificateValidation.fromDns(hostedZone)
        });

        // NOTE: the subnets are created but not associated to the vpc via the vpc's route table -- actually, each subnet gets its own route table?!
        // ...this an issue at all?!  see if missing subnet group is the reason
        const vpc = new Vpc(this, 'ServerlessVPC', {
            vpcName: infrastructureConfig.vpcName,
            cidr: infrastructureConfig.vpcCIDR,
            // natGateways: 0,
            // vpnGateway: false,
            maxAzs: 2,
            // subnetConfiguration: [
            //     {
            //         name: infrastructureConfig.vpcSubnetGroupNames[0],
            //         subnetType: SubnetType.PRIVATE_ISOLATED
            //     },
            //     {
            //         name: infrastructureConfig.vpcSubnetGroupNames[1],
            //         subnetType: SubnetType.PRIVATE_ISOLATED
            //     }
            // ]
        });
        Tags.of(vpc).add(TagEnum.APPLICATION_ID, appId);
        Tags.of(vpc).add(TagEnum.NAME, infrastructureConfig.vpcName);
        
        // TODO: configure security group(s) for the VPC to allow common protocols: 80, 443, 5432

        // TOOD: re-enable app bucket as needed
        // const appBucket = new Bucket(this, 'LambdaAppBucket', {
        //     bucketName: `${infrastructureConfig.appBucketName}-${appId}-${region}`,
        //     versioned: true,
        //     blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        //     encryption: BucketEncryption.KMS,
        //     encryptionKey: Alias.fromAliasName(this, 'ServerlessAppS3KMSLookup', infrastructureConfig.kmsAlias),
        //     bucketKeyEnabled: true
        // });
        // TODO: configure bucket policies to ensure only the app execution role and the application's lambda function can access the bucket

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

        // TODO: grant the permissions to the bucket(s) through the lambda's execution role instead -- so 'appBucket' isn't required
        // appBucket.grantReadWrite(lambdaApp);

        // TODO: properly secure -- specific ports
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
            // vpcSubnets: {
            //     subnetGroupName: infrastructureConfig.vpcSubnetGroupNames[0]
            // }
            environmentEncryption: kmsKey,
            tracing: infrastructureConfig.xrayTracingEnabled ? Tracing.ACTIVE : Tracing.DISABLED,
            securityGroups: [lambdaApiSecurityGroup],
            environment: {
                BUCKET: `${infrastructureConfig.contentBucketName}-${appId}-${region}`,
                // TODO: configure endpoint for the database
            },
            // TODO: apply a custom role; errors: The policy ServerlessAppExecutionRoleLookupPolicyA389FE16 already exists on the role serverless_app_execution_role-appid.
            // role: Role.fromRoleArn(this, 'ServerlessAppExecutionRoleLookup', `arn:aws:iam::${this.account}:role/service-role/${infrastructureConfig.appExecutionRoleName}-${appId}`)
        });

        // TODO: properly secure -- specific ports
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
            }
        });

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
            })
        });

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


        // TODO: consider if this (or at least route 53 config) belongs in dr infrastructure stack
        // see https://sbstjn.com/blog/aws-cdk-lambda-loadbalancer-vpc-certificate/
        // TODO: create the approriate associations to Route 53 and an ALB/ELB to ensure redundancy and failover (optionally using health-checks in the application's route 53 config)
        // TODO: output the appropriate access point for the application: http(s) URL

        // TODO: create a db subnet group using the rds subnet -- question: will 2 AZs be required for multi-region/replication to work?!
        // ...not including the 2 planned above where 1 AZ is for Blue, 1 for Green -- these would not provide high availability
        // ...so would this solution require 3 AZs in each environment -- 12 total?!
        // NOTE: may need to move this to another stack -- prerequisite: 2 regions, 2 AZs, 2 db subnet groups (1 in each region) -- must first exist
        // const dbSubnetGroup = new SubnetGroup(this, 'ServerlessDbSubnetGroup', {
        //     vpc: vpc,
        //     subnetGroupName: infrastructureConfig.databaseSubnetGroupName,
        //     description: infrastructureConfig.databaseSubnetGroupDescription,
        //     vpcSubnets: {
        //         // availabilityZones: ['us-west-1a'],
        //         onePerAz: true,
        //         // subnetFilters: '',
        //         // subnetGroupName: infrastructureConfig.databaseSubnetGroupName,
        //         // subnetType: SubnetType.PRIVATE_ISOLATED,
        //         subnets: vpc.isolatedSubnets // TODO: filter and ensure only the 'PrivateSubnetRDSX' subnets are used
        //     }
        // });

        // TODO: create a cost-effective Aurora Postgres RDS cluster on the dedicated private subnet of the new vpc
        // TODO: should be compatible with Aurora Global Database -- see engine and instance size requirements
        // NOTE: synth fails with: Error: There are no subnet groups with name 'serverless-db-subnet-group' in this VPC. Available names: PrivateSubnetLambda1,PrivateSubnetRDS1,PrivateSubnetRDS2
        // const rdsCluster = new DatabaseCluster(this, 'ServerlessDbCluster', {
        //     defaultDatabaseName: infrastructureConfig.databaseName,
        //     engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
        //     parameterGroup: ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', infrastructureConfig.databaseParameterGroupName),
        //     instanceProps: {
        //         instanceType: InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.MEDIUM),
        //         vpc: vpc,
        //         vpcSubnets: {
        //             subnetGroupName: infrastructureConfig.databaseSubnetGroupName
        //         },
        //         publiclyAccessible: false
        //     }
        // });

        // TODO: optional - add consistent tags to the resources to include the app name and appid -- "appname: serverless"
        // TODO: ensure traceability through x-ray; ideally make tracing optional (configurable, all-or-nothing)
    }
}
