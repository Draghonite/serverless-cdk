#!/usr/bin/env node
import { InfrastructureConfig } from './../config/InfrastructureConfig';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as uuid from 'uuid';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
import { ServerlessSharedInfrastructureStack } from '../lib/infrastructure/serverless-shared-infrastructure-stack';
import { AppProps } from 'aws-cdk-lib';

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

const sharedStack = new ServerlessSharedInfrastructureStack(app, 'ServerlessSharedInfrastructureStack');

// TODO: re-enable
// sharedStack.addDependency(primaryRegionStack);
// sharedStack.addDependency(secondaryRegionStack);