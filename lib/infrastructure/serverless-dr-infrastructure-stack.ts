import { InfrastructureConfig } from './../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as uuid from 'uuid';
import { AuroraEngineVersion, AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine, ParameterGroup, PostgresEngineVersion, SubnetGroup } from 'aws-cdk-lib/aws-rds';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket, CfnBucket, CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3';

export class ServerlessDRInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;
        const regionIdMap: Map<string, any> = scope.node.tryGetContext('regionIdMap');
        let shortId = Math.random().toString(36);
        if (shortId.includes('0.')) {
            shortId = shortId.split('0.')[1];
        }

        // #region Multi-Region Access Point in S3 for all-way replication across regions for the app buckets
        // ...https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiRegionAccessPoints.html
        // ...https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.CfnMultiRegionAccessPoint.html

        const appBucketMultiRegionAccessPoint = new CfnMultiRegionAccessPoint(this, 'ServerlessAppBucketMRAP', {
            name: `${infrastructureConfig.appBucketMultiRegionAccessPointName}-${shortId}`,
            regions: Array.from(regionIdMap.values()).map((regionId: any) => { 
                return { 
                    bucket: `${infrastructureConfig.appBucketName}-${regionId.region}-${regionId.uuid}`
                }
            })
        });

        // TODO: create the replication settings w/ all available options

        // TODO: duplicate for api buckets

        // #endregion
    }
}