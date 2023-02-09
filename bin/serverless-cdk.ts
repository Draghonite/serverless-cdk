#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { App, AppProps, Stack, Tags } from 'aws-cdk-lib';
import { InfrastructureConfig, TagEnum } from './../config/InfrastructureConfig';
import { ServerlessInfrastructureStack } from '../lib/infrastructure/serverless-infrastructure-stack';
import { ServerlessPreInfrastructureStack } from '../lib/infrastructure/serverless-pre-infrastructure-stack';
import { ServerlessInfrastructureContentBucketStack } from './../lib/infrastructure/serverless-infrastructure-content-bucket-stack';
import { ServerlessPostInfrastructureStack } from '../lib/infrastructure/serverless-post-infrastructure-stack';
import { Peer, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { AuroraPostgresEngineVersion, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { GlobalAuroraRDSMaster as GlobalAuroraRDSPrimary, GlobalAuroraRDSSlaveInfra as GlobalAuroraRDSSecondary, InstanceTypeEnum } from 'cdk-aurora-globaldatabase';

const infrastructureConfig = InfrastructureConfig;

// appId guard to ensure a unique identifier for the application is specified, see README
if (!process.env.APP_ID && !infrastructureConfig.appId) {
    throw new Error("The 'appId' is not configured; either set the 'APP_ID' argument via CLI or the 'appId' InfrastructureConfig property.");
}

const appId = process.env.APP_ID || infrastructureConfig.appId;

// database deployment guard
// TODO: keeps failing no matter what with: Error: There are no 'Public' subnet groups in this VPC. Available types: Isolated,Deprecated_Isolated
if (process.env.DB_DEPLOYMENT) {
    // #region Database Deployment

    const appDb = new App();
    const envPrimary  = { account: process.env.CDK_DEFAULT_ACCOUNT, region: infrastructureConfig.regions.primary };
    const envSecondary = { account: process.env.CDK_DEFAULT_ACCOUNT, region: infrastructureConfig.regions.secondary };

    const stackPrimary = new Stack(appDb, 'ServerlessDbPrimaryStack', { env: envPrimary });
    const stackSecondary = new Stack(appDb, 'ServerlessDbSecondaryStack', { env: envSecondary });
    
    const vpcPrimary = Vpc.fromLookup(stackPrimary, 'VpcPrimaryLookup', {
        region: infrastructureConfig.regions.primary,
        vpcName: infrastructureConfig.vpcName
    });
    const vpcSecondary = Vpc.fromLookup(stackSecondary, 'VpcSecondaryLookup', {
        region: infrastructureConfig.regions.secondary,
        vpcName: infrastructureConfig.vpcName
    });

    const dbCredentialSecrets = new Secret(stackPrimary, 'ServerlessDbSecrets', {
        secretName: `${infrastructureConfig.databaseClusterName}-credentials`,
        generateSecretString: {
            secretStringTemplate: JSON.stringify({
                username: infrastructureConfig.databaseName
            }),
            excludePunctuation: true,
            includeSpace: false,
            generateStringKey: 'password'
        }
    });
    Tags.of(dbCredentialSecrets).add(TagEnum.APPLICATION_ID, appId);
    Tags.of(dbCredentialSecrets).add(TagEnum.NAME, `${infrastructureConfig.databaseClusterName}-${appId}-${infrastructureConfig.regions.primary}-credentials`);

    const rdsGlobalCluster = new GlobalAuroraRDSPrimary(stackPrimary, 'ServerlessDbGlobalCluster', {
        deletionProtection: !infrastructureConfig.isDevTesting,
        instanceType: InstanceTypeEnum.R5_LARGE,
        vpc: vpcPrimary,
        engineVersion: DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_7 }),
        defaultDatabaseName: infrastructureConfig.databaseName,
        credentials: {
            username: infrastructureConfig.databaseUsername,
            password: dbCredentialSecrets.secretValueFromJson('password')
        },
        parameters: {
            'rds.force_ssl': '1',
            'rds.log_retention_period': '10080',
            'auto_explain.log_min_duration': '5000',
            'auto_explain.log_verbose': '1',
            'timezone': 'UTC+8',
            'shared_preload_libraries': 'auto_explain,pg_stat_statements,pg_hint_plan,pgaudit',
            'log_connections': '1',
            'log_statement': 'ddl',
            'log_disconnections': '1',
            'log_lock_waits': '1',
            'log_min_duration_statement': '5000',
            'log_rotation_age': '1440',
            'log_rotation_size': '102400',
            'random_page_cost': '1',
            'track_activity_query_size': '16384',
            'idle_in_transaction_session_timeout': '7200000'
        }
    });
    rdsGlobalCluster.rdsCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpcPrimary.vpcCidrBlock));

    Tags.of(rdsGlobalCluster).add(TagEnum.APPLICATION_ID, appId);
    Tags.of(rdsGlobalCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

    const rdsSecondaryCluster = new GlobalAuroraRDSSecondary(stackSecondary, 'ServerlessDbSecondaryCluster', {
        vpc: vpcSecondary
    });

    Tags.of(rdsSecondaryCluster).add(TagEnum.APPLICATION_ID, appId);
    Tags.of(rdsSecondaryCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

    stackPrimary.addDependency(stackSecondary);

    rdsGlobalCluster.addRegionalCluster(stackPrimary, 'ServerlessDbRegionalCluster', {
        region: infrastructureConfig.regions.secondary,
        dbSubnetGroupName: rdsSecondaryCluster.dbSubnetGroup.dbSubnetGroupName
    });

    // #endregion
} else {
    // #region Application Deployment

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
            appId: appId,
            shouldConfigureReplication: /yes|true/i.test(process.env.INCLUDE_REPLICATION || ''),
            recordSetName: process.env.DNS_RECORD_SET,
            certificateDomainName: process.env.CERTIFICATE_DOMAIN_NAME,
            hostedZoneId: process.env.HOSTED_ZONE_ID,
            primaryRegionTrafficWeight: process.env.PRIMARY_WEIGHT || infrastructureConfig.primaryRegionTrafficWeight,
            secondaryRegionTrafficWeight: process.env.SECONDARY_WEIGHT || infrastructureConfig.secondaryRegionTrafficWeight
        }
    });
    const app = new cdk.App(appProps);

    // before
    const preStack = new ServerlessPreInfrastructureStack(app, 'ServerlessPreInfrastructureStack', {
        env: { region: infrastructureConfig.regions.primary },
        stackName: 'ServerlessPreInfrastructureStack'
    });

    // primary region
    const primaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack1', {
        env: { region: infrastructureConfig.regions.primary },
        stackName: 'ServerlessInfrastructureContentBucketStack'
    });

    const primaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion1', {
        env: { region: infrastructureConfig.regions.primary },
        stackName: 'ServerlessInfrastructureStack'
    });

    // secondary region
    const secondaryRegionContentBucketStack = new ServerlessInfrastructureContentBucketStack(app, 'ServerlessInfrastructureContentBucketStack2', {
        env: { region: infrastructureConfig.regions.secondary },
        stackName: 'ServerlessInfrastructureContentBucketStack'
    });

    const secondaryRegionStack = new ServerlessInfrastructureStack(app, 'ServerlessInfrastructureStackRegion2', {
        env: { region: infrastructureConfig.regions.secondary },
        stackName: 'ServerlessInfrastructureStack'
    });

    // after
    const postStack = new ServerlessPostInfrastructureStack(app, 'ServerlessPostInfrastructureStack', {
        env: { region: infrastructureConfig.regions.primary },
        stackName: 'ServerlessPostInfrastructureStack'
    });

    primaryRegionStack.addDependency(preStack);
    secondaryRegionStack.addDependency(preStack);
    primaryRegionContentBucketStack.addDependency(primaryRegionStack);
    secondaryRegionStack.addDependency(primaryRegionContentBucketStack);
    secondaryRegionContentBucketStack.addDependency(secondaryRegionStack);
    postStack.addDependency(primaryRegionStack);
    postStack.addDependency(secondaryRegionStack);

    // #endregion
}