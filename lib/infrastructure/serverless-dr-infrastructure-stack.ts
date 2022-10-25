import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, CfnBucket, CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3';

export class ServerlessDRInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appBucketArns = cdk.Fn.importListValue(infrastructureConfig.appBucketArnOutput, 1);
        const regionIdMap: Map<string, any> = scope.node.tryGetContext('regionIdMap');
        const regionId = regionIdMap.get(props?.env?.region || '');
        const shortId: string = scope.node.tryGetContext('shortId');
        const accountId: string = scope.node.tryGetContext('account');
        const region = regionId?.region ?? props?.env?.region;
        const account = accountId ?? props?.env?.account;

        // TODO: reserved for any shared infrastructure
    }
}