#!/usr/bin/env node
import { InfrastructureConfig } from './../config/InfrastructureConfig';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as uuid from 'uuid';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
// import { ServerlessDRInfrastructureStack } from '../lib/infrastructure/serverless-dr-infrastructure-stack';
import { AppProps } from 'aws-cdk-lib';
// import { S3ReplicationRoleCreator } from '../temp/iam_create_replication_role'; 

// TODO: allow override from environment
const infrastructureConfig = InfrastructureConfig;
const primaryRegion = 'us-west-1';
const secondaryRegion = 'us-west-2';

// overrides the default context to pass additional parameters shared across stacks w/o dependency on CF Output Parameters
const regionIdMap = new Map();
regionIdMap.set(primaryRegion, { region: primaryRegion, uuid: uuid.v4() });
regionIdMap.set(secondaryRegion, { region: secondaryRegion, uuid: uuid.v4() });
let shortId = Math.random().toString(36);
if (shortId.includes('0.')) {
    shortId = shortId.split('0.')[1];
}
const appProps: AppProps = Object.assign({}, {
    context: {
        regionIdMap: regionIdMap,
        shortId: shortId
    }
});
const app = new cdk.App(appProps);

const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: {
        region: primaryRegion
    }
});

const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: {
        region: secondaryRegion
    }
});

// const disasterRecoverPrimaryStack = new ServerlessDRInfrastructureStack(app, 'ServerlessDRInfrastructurePrimaryStack', {
//     env: {
//         region: primaryRegion
//     }
// });

// const disasterRecoverSecondaryStack = new ServerlessDRInfrastructureStack(app, 'ServerlessDRInfrastructureSecondaryStack', {
//     env: {
//         region: secondaryRegion
//     }
// });

// disasterRecoverPrimaryStack.addDependency(primaryRegionStack);
// disasterRecoverPrimaryStack.addDependency(secondaryRegionStack);
// disasterRecoverSecondaryStack.addDependency(primaryRegionStack);
// disasterRecoverSecondaryStack.addDependency(secondaryRegionStack);

// TODO: run only for deploy
// NOTE: create the role used for bidirectional replication in S3
// const primaryRegionId = regionIdMap.get(primaryRegion);
// const secondaryRegionId = regionIdMap.get(secondaryRegion);
// const appPrimaryBucketName = `${infrastructureConfig.appBucketName}-${primaryRegion}-${primaryRegionId.uuid}`;
// const appSecondaryBucketName = `${infrastructureConfig.appBucketName}-${secondaryRegion}-${secondaryRegionId.uuid}`;
// new S3ReplicationRoleCreator(infrastructureConfig.s3ReplicationRoleName, primaryRegion, secondaryRegion, appPrimaryBucketName, appSecondaryBucketName);

// TODO: apply bidirectional replication rules to the buckets but only after the buckets are created
// ...any way to make this wait?
