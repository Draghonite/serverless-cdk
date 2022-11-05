#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as uuid from 'uuid';
import { ServerlessPostInfrastructureStack } from './../lib/infrastructure/serverless-post-infrastructure-stack';
import { InfrastructureConfig } from './../config/InfrastructureConfig';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
import { ServerlessPreInfrastructureStack } from '../lib/infrastructure/serverless-pre-infrastructure-stack';
import { AppProps } from 'aws-cdk-lib';

const infrastructureConfig = InfrastructureConfig;

// overrides the default context to pass additional parameters shared across all stacks in this application w/o dependency on CF Output Parameters
const regionIdMap = new Map();
regionIdMap.set(infrastructureConfig.regions.primary, { region: infrastructureConfig.regions.primary, uuid: uuid.v4() });
regionIdMap.set(infrastructureConfig.regions.secondary, { region: infrastructureConfig.regions.secondary, uuid: uuid.v4() });
let shortId = Math.random().toString(36);
if (shortId.includes('0.')) {
    shortId = shortId.split('0.')[1];
}
// shortId = 'staticid'; // TODO: remove for official use

const appProps: AppProps = Object.assign({}, {
    context: {
        regionIdMap: regionIdMap,
        shortId: shortId
    }
});
const app = new cdk.App(appProps);

const preStack = new ServerlessPreInfrastructureStack(app, 'ServerlessPreInfrastructureStack', {
    env: {
        region: infrastructureConfig.regions.primary,
        // account: process.env.CDK_DEFAULT_ACCOUNT
    }
});

const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: {
        region: infrastructureConfig.regions.primary,
        // account: process.env.CDK_DEFAULT_ACCOUNT
    }
});

// s3 region1

const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: {
        region: infrastructureConfig.regions.secondary,
        // account: process.env.CDK_DEFAULT_ACCOUNT
    }
});

// s3 region2

// s3 region1->region2 crr

// s3 region2->region1 crr

// const postStack = new ServerlessPostInfrastructureStack(app, 'ServerlessPostInfrastructureStack', {
//     env: {
//         region: infrastructureConfig.regions.primary,
//         // account: process.env.CDK_DEFAULT_ACCOUNT
//     }
// });

primaryRegionStack.addDependency(preStack);
secondaryRegionStack.addDependency(preStack);
// postStack.addDependency(preStack);
// postStack.addDependency(primaryRegionStack);
// postStack.addDependency(secondaryRegionStack);