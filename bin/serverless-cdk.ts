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

// appId guard to ensure a unique identifier for the application is specified, see README
if (!process.env.APP_ID && !infrastructureConfig.appId) {
    throw new Error("The 'appId' is not configured; either set the 'APP_ID' argument via CLI or the 'appId' InfrastructureConfig property.");
}
if (!process.env.HOSTED_ZONE_ID) {
    throw new Error("The 'hostedZoneId' is not configured; set the 'HOSTED_ZONE_ID' via CLI");
}
if (!process.env.DNS_RECORD_SET) {
    throw new Error("The 'recordSetName' is not configured; set the 'DNS_RECORD_SET' via CLI");
}
if (!process.env.CERTIFICATE_DOMAIN_NAME) {
    throw new Error("The 'hostedZoneName' is not configured; set the 'CERTIFICATE_DOMAIN_NAME' via CLI");
}

// extends the default context to pass additional parameters shared across all stacks in this application
const appProps: AppProps = Object.assign({}, {
    context: {
        appId: process.env.APP_ID || infrastructureConfig.appId,
        shouldConfigureReplication: /yes|true/i.test(process.env.INCLUDE_REPLICATION || ''),
        recordSetName: process.env.DNS_RECORD_SET,
        certificateDomainName: process.env.CERTIFICATE_DOMAIN_NAME,
        hostedZoneId: process.env.HOSTED_ZONE_ID,
        primaryRegionTrafficWeight: process.env.PRIMARY_WEIGHT || infrastructureConfig.primaryRegionTrafficWeight,
        secondaryRegionTrafficWeight: process.env.SECONDARY_WEIGHT || infrastructureConfig.secondaryRegionTrafficWeight
    }
});
const app = new cdk.App(appProps);

const preStack = new ServerlessPreInfrastructureStack(app, 'ServerlessPreInfrastructureStack', {
    env: { region: infrastructureConfig.regions.primary },
    stackName: 'ServerlessPreInfrastructureStack'
});

const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: { region: infrastructureConfig.regions.primary },
    stackName: 'ServerlessInfrastructureStack'
});

// content s3 region1
const primaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack1', {
    env: { region: infrastructureConfig.regions.primary },
    stackName: 'ServerlessInfrastructureContentBucketStack'
});

const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: { region: infrastructureConfig.regions.secondary },
    stackName: 'ServerlessInfrastructureStack'
});

// content s3 region2
const secondaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack2', {
    env: { region: infrastructureConfig.regions.secondary },
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
primaryRegionContentBucketStack.addDependency(primaryRegionStack);
secondaryRegionStack.addDependency(primaryRegionContentBucketStack);
secondaryRegionContentBucketStack.addDependency(secondaryRegionStack);
// postStack.addDependency(preStack);
// postStack.addDependency(primaryRegionStack);
// postStack.addDependency(secondaryRegionStack);