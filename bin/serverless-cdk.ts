#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as uuid from 'uuid';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
import { ServerlessDRInfrastructureStack } from '../lib/infrastructure/serverless-dr-infrastructure-stack';
import { AppProps } from 'aws-cdk-lib';

// TODO: allow override from environment
const primaryRegion = 'us-west-1';
const secondaryRegion = 'us-west-2';

// overrides the default context to pass additional parameters shared across stacks w/o dependency on CF Output Parameters
const regionIdMap = new Map();
regionIdMap.set(primaryRegion, { region: primaryRegion, uuid: uuid.v4() });
regionIdMap.set(secondaryRegion, { region: secondaryRegion, uuid: uuid.v4() });
const appProps: AppProps = Object.assign({}, {
    context: {
        regionIdMap: regionIdMap
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

const disasterRecoverStack = new ServerlessDRInfrastructureStack(app, 'ServerlessDRInfrastructureStack', {
    env: {
        region: primaryRegion
    }
});

disasterRecoverStack.addDependency(primaryRegionStack);
disasterRecoverStack.addDependency(secondaryRegionStack);