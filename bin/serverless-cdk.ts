#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppProps } from 'aws-cdk-lib';
import * as uuid from 'uuid';
import { ServerlessPostInfrastructureStack } from './../lib/infrastructure/serverless-post-infrastructure-stack';
import { InfrastructureConfig } from './../config/InfrastructureConfig';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
import { ServerlessPreInfrastructureStack } from '../lib/infrastructure/serverless-pre-infrastructure-stack';
import { ServerlessInfrastructureContentBucketStack } from './../lib/infrastructure/serverless-infrastructure-content-bucket-stack';

const infrastructureConfig = InfrastructureConfig;

/*
    NOTE: provides a unique identifier for the application

    Set to empty-string to use a random, ~11-character identifier
*/
const appId = 'appid'; 

// overrides the default context to pass additional parameters shared across all stacks in this application w/o dependency on CF Output Parameters
const appProps: AppProps = Object.assign({}, {
    context: {
        appId: appId || Math.random().toString(36).replace('0.', ''),
        /*
            TODO: very important to configure the following setting accordingly!
             - 'cdk deploy --all' initially set to false to create the buckets across the regions
             - change to true and 'cdk deploy --all' again to add cross-region, bi-directional replication on the buckets
            NOTE: running in this sequence -- false->true->false -- would remove replication configuration
        */
        shouldConfigureReplication: true 
    }
});
const app = new cdk.App(appProps);

console.log(`*** [shouldConfigureReplication]: ${appProps?.context?.shouldConfigureReplication}`);

const preStack = new ServerlessPreInfrastructureStack(app, 'ServerlessPreInfrastructureStack', {
    env: { region: infrastructureConfig.regions.primary /*, account: process.env.CDK_DEFAULT_ACCOUNT*/ },
    stackName: 'ServerlessPreInfrastructureStack'
});

const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: { region: infrastructureConfig.regions.primary /*, account: process.env.CDK_DEFAULT_ACCOUNT*/ },
    stackName: 'ServerlessInfrastructureStack'
});

// content s3 region1
const primaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack1', {
    env: { region: infrastructureConfig.regions.primary /*, account: process.env.CDK_DEFAULT_ACCOUNT*/ },
    stackName: 'ServerlessInfrastructureContentBucketStack'
});

const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: { region: infrastructureConfig.regions.secondary /*, account: process.env.CDK_DEFAULT_ACCOUNT*/ },
    stackName: 'ServerlessInfrastructureStack'
});

// content s3 region2
const secondaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack2', {
    env: { region: infrastructureConfig.regions.secondary /*, account: process.env.CDK_DEFAULT_ACCOUNT*/ },
    stackName: 'ServerlessInfrastructureContentBucketStack'
});

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
primaryRegionContentBucketStack.addDependency(primaryRegionStack);
secondaryRegionStack.addDependency(primaryRegionContentBucketStack);
secondaryRegionContentBucketStack.addDependency(secondaryRegionStack);