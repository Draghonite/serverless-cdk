import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnParameter } from 'aws-cdk-lib';

export class ServerlessInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const infrastructureConfig = InfrastructureConfig;

    // #region Parameters

    const vpcName = new CfnParameter(this, 'vpcName', {
        type: 'String',
        description: 'Name of the VPC',
        minLength: 2,
        default: 'serverless-vpc'
    });

    const availabilityZones = new CfnParameter(this, 'availabilityZones', {
        type: 'Number',
        description: 'Number of availability zones to use for the VPC',
        minValue: 1,
        maxValue: 3,
        default: 2
    });

    const restApiName = new CfnParameter(this, 'restApiName', {
        type: 'String',
        description: 'Name of the API Gateway REST resource',
        default: 'Serverless API'
    });

    const restApiDescription = new CfnParameter(this, 'restApiDescription', {
        type: 'String',
        description: 'Description for the API Gateway REST resource',
        default: 'API that provides an access point for the application'
    });

    const appBucketName = new CfnParameter(this, 'appBucketName', {
        type: 'String',
        description: 'Name of the S3 bucket for the application',
        default: 'serverless-app-sidemotion'
    });

    const appLambdaName = new CfnParameter(this, 'lambdaApiName', {
        type: 'String',
        description: 'Name of the Lambda function for the application',
        default: 'serverless-app'
    });

    // #endregion

    const vpc = new Vpc(this, 'ServerlessVPC', {
        vpcName: vpcName.valueAsString,
        cidr: infrastructureConfig.vpcCIDR,
        natGateways: 0,
        vpnGateway: false,
        maxAzs: availabilityZones.valueAsNumber,
        subnetConfiguration: [
            {
                name: 'PrivateSubnetLambda',
                subnetType: SubnetType.PRIVATE_ISOLATED
            },
            {
                name: 'PrivateSubnetRDS',
                subnetType: SubnetType.PRIVATE_ISOLATED
            }
        ]
    });

    const appBucket = new Bucket(this, 'LambdaAppBucket', {
        bucketName: `${appBucketName.valueAsString}-${props?.env?.region}`
    });

    const lambdaApp = new lambda.Function(this, 'LamdaAppHandler', {
        functionName: appLambdaName.valueAsString,
        runtime: lambda.Runtime.NODEJS_16_X,
        code: lambda.Code.fromAsset('resources'),
        handler: 'widgets.main',
        environment: {
            BUCKET: appBucket.bucketName
        },
        memorySize: 128,
        timeout: cdk.Duration.seconds(10),
        // vpc: vpc,
        // vpcSubnets: {
        //     subnetType: SubnetType.PRIVATE_ISOLATED
        // }
    });

    appBucket.grantReadWrite(lambdaApp);

    const api = new apigateway.RestApi(this, 'ServerlessAPI', {
        restApiName: restApiName.valueAsString,
        description: restApiDescription.valueAsString
    });

    api.root.addMethod('GET', new apigateway.LambdaIntegration(lambdaApp, {
        requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    }));
  }
}
