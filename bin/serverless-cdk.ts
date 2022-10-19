#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';

const app = new cdk.App();

new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
    env: {
        region: 'us-west-1'
    }
});

new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
    env: {
        region: 'us-west-2'
    }
});

// const infrastructureTemplate = Template.fromStack(infrastructureStack);

// console.log(infrastructureTemplate.toJSON());