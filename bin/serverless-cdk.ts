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
const appProps: AppProps = Object.assign({}, {
    context: {
        regionIdMap: regionIdMap,
        shortId: shortId
    }
});
const app = new cdk.App(appProps);

const preStack = new ServerlessPreInfrastructureStack(app, 'ServerlessPreInfrastructureStack', {
    env: {
        region: infrastructureConfig.regions.primary
    }
});

const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: {
        region: infrastructureConfig.regions.primary
    }
});

const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: {
        region: infrastructureConfig.regions.secondary
    }
});

const postStack = new ServerlessPostInfrastructureStack(app, 'ServerlessPostInfrastructureStack', {
    env: {
        region: infrastructureConfig.regions.primary
    }
});

primaryRegionStack.addDependency(preStack);
secondaryRegionStack.addDependency(preStack);
postStack.addDependency(primaryRegionStack);
postStack.addDependency(secondaryRegionStack);