import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { BlockPublicAccess, Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import * as uuid from 'uuid';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal, Effect } from 'aws-cdk-lib/aws-iam';

export class ServerlessInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const infrastructureConfig = InfrastructureConfig;
    const regionIdMap: Map<string, any> = scope.node.tryGetContext('regionIdMap');
    const regionId = regionIdMap.get(props?.env?.region || '');
    const uniqueId = regionId?.uuid ?? uuid.v4();
    const region = regionId?.region ?? props?.env?.region;

    // TODO: add consistent tags to the resources -- "appname: serverless"

    // NOTE: the subnets are created but not associated to the vpc via the vpc's route table -- actually, each subnet gets its own route table?!
    // ...this an issue at all?!  see if missing subnet group is the reason
    const vpc = new Vpc(this, 'ServerlessVPC', {
        vpcName: infrastructureConfig.vpcName,
        cidr: infrastructureConfig.vpcCIDR,
        natGateways: 0,
        vpnGateway: false,
        maxAzs: 3,
        subnetConfiguration: [
            {
                name: 'PrivateSubnetLambda1',
                subnetType: SubnetType.PRIVATE_ISOLATED
            },
            {
                name: 'PrivateSubnetRDS1',
                subnetType: SubnetType.PRIVATE_ISOLATED
            },
            {
                name: 'PrivateSubnetRDS2',
                subnetType: SubnetType.PRIVATE_ISOLATED
            }
        ]
    });
    new CfnOutput(this, 'ServerlessVPCIdOutput', {
        value: vpc.vpcId,
        exportName: infrastructureConfig.vpcIdOutput
    });
    
    // TODO: configure security group(s) for the VPC to allow common protocols: 80, 443, 5432

    const appBucket = new Bucket(this, 'LambdaAppBucket', {
        // NOTE: to satisfy global-uniqueness constraint but update as needed; should revisit and remove unawanted S3 buckets that would linger
        bucketName: `${infrastructureConfig.appBucketName}-${region}-${uniqueId}`,
        versioned: true,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
    new CfnOutput(this, 'ServerlessLambdaAppBucketArnOutput', {
        value: appBucket.bucketArn,
        exportName: infrastructureConfig.appBucketArnOutput
    });
    new CfnOutput(this, 'ServerlessLambdaAppBucketNameOutput', {
        value: appBucket.bucketName,
        exportName: infrastructureConfig.appBucketNameOutput
    });

    // TODO: ensure the lambda function has code for testing database connectivity -- use 'pg' node module and query against a standard sys database, or some other query
    // TODO: add a function for basic heart-beat check: access to db should suffice; return 200: OK
    const lambdaApp = new lambda.Function(this, 'LamdaAppHandler', {
        functionName: infrastructureConfig.appLambdaName,
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromAsset('resources'),
        handler: 'widgets.main',
        environment: {
            BUCKET: appBucket.bucketName
        },
        memorySize: 128,
        timeout: cdk.Duration.seconds(30),
        // vpc: vpc,
        // vpcSubnets: {
        //     subnetGroupName: 'PrivateSubnetLambda'
        // }
    });

    appBucket.grantReadWrite(lambdaApp);

    // TODO: add an api-endpoint for health-checks at "/health"; should execute the appropriate lambda function
    const api = new apigateway.RestApi(this, 'ServerlessAPI', {
        restApiName: infrastructureConfig.restApiName,
        description: infrastructureConfig.restApiDescription
    });

    api.root.addMethod('GET', new apigateway.LambdaIntegration(lambdaApp, {
        requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    }));

    // TODO: consider if this (or at least route 53 config) belongs in dr infrastructure stack
    // see https://sbstjn.com/blog/aws-cdk-lambda-loadbalancer-vpc-certificate/
    // TODO: create the approriate associations to Route 53 and an ALB/ELB to ensure redundancy and failover using health-checks in the application's route 53 config
    // TODO: output the appropriate access point for the application: http(s) URL

    // TODO: create a db subnet group using the rds subnet -- question: will 2 AZs be required for multi-region/replication to work?!
      // ...not including the 2 planned above where 1 AZ is for Blue, 1 for Green -- these would not provide high availability
      // ...so would this solution require 3 AZs in each environment -- 12 total?!
    // NOTE: may need to move this to another stack -- prerequisite: 2 regions, 2 AZs, 2 db subnet groups (1 in each region) -- must first exist
    const dbSubnetGroup = new SubnetGroup(this, 'ServerlessDbSubnetGroup', {
        vpc: vpc,
        subnetGroupName: infrastructureConfig.databaseSubnetGroupName,
        description: infrastructureConfig.databaseSubnetGroupDescription,
        vpcSubnets: {
            // availabilityZones: ['us-west-1a'],
            onePerAz: true,
            // subnetFilters: '',
            // subnetGroupName: infrastructureConfig.databaseSubnetGroupName,
            // subnetType: SubnetType.PRIVATE_ISOLATED,
            subnets: vpc.isolatedSubnets // TODO: filter and ensure only the 'PrivateSubnetRDSX' subnets are used
        }
    });

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
  }
}
