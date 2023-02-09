import { InfrastructureConfig, TagEnum } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { CfnGlobalCluster, AuroraPostgresEngineVersion, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { Tags } from 'aws-cdk-lib';
import { GlobalAuroraRDSMaster as GlobalAuroraRDSPrimary, GlobalAuroraRDSSlaveInfra as GlobalAuroraRDSSecondary, InstanceTypeEnum } from 'cdk-aurora-globaldatabase';
import { Peer, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export class ServerlessPostInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appId: string = scope.node.tryGetContext('appId');
        // const vpcPrimary = Vpc.fromLookup(this, 'VpcPrimaryLookup', {
        //     region: infrastructureConfig.regions.primary,
        //     vpcName: infrastructureConfig.vpcName
        // });
        // const vpcSecondary = Vpc.fromLookup(this, 'VpcSecondaryLookup', {
        //     region: infrastructureConfig.regions.secondary,
        //     vpcName: infrastructureConfig.vpcName
        // });

        // // #region Global RDS Cluster

        // const dbCredentialSecrets = new Secret(this, 'ServerlessDbSecrets', {
        //     secretName: `${infrastructureConfig.databaseClusterName}-credentials`,
        //     generateSecretString: {
        //         secretStringTemplate: JSON.stringify({
        //             username: infrastructureConfig.databaseName
        //         }),
        //         excludePunctuation: true,
        //         includeSpace: false,
        //         generateStringKey: 'password'
        //     }
        // });
        // Tags.of(dbCredentialSecrets).add(TagEnum.APPLICATION_ID, appId);
        // Tags.of(dbCredentialSecrets).add(TagEnum.NAME, `${infrastructureConfig.databaseClusterName}-${appId}-${infrastructureConfig.regions.primary}-credentials`);

        // const rdsGlobalCluster = new GlobalAuroraRDSPrimary(this, 'ServerlessDbGlobalCluster', {
        //     deletionProtection: !infrastructureConfig.isDevTesting,
        //     instanceType: InstanceTypeEnum.R5_LARGE,
        //     vpc: vpcPrimary,
        //     engineVersion: DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_7 }),
        //     defaultDatabaseName: infrastructureConfig.databaseName,
        //     credentials: {
        //         username: infrastructureConfig.databaseUsername,
        //         password: dbCredentialSecrets.secretValueFromJson('password')
        //     },
        //     parameters: {
        //         'rds.force_ssl': '1',
        //         'rds.log_retention_period': '10080',
        //         'auto_explain.log_min_duration': '5000',
        //         'auto_explain.log_verbose': '1',
        //         'timezone': 'UTC+8',
        //         'shared_preload_libraries': 'auto_explain,pg_stat_statements,pg_hint_plan,pgaudit',
        //         'log_connections': '1',
        //         'log_statement': 'ddl',
        //         'log_disconnections': '1',
        //         'log_lock_waits': '1',
        //         'log_min_duration_statement': '5000',
        //         'log_rotation_age': '1440',
        //         'log_rotation_size': '102400',
        //         'random_page_cost': '1',
        //         'track_activity_query_size': '16384',
        //         'idle_in_transaction_session_timeout': '7200000'
        //     }
        // });
        // rdsGlobalCluster.rdsCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpcPrimary.vpcCidrBlock));

        // Tags.of(rdsGlobalCluster).add(TagEnum.APPLICATION_ID, appId);
        // Tags.of(rdsGlobalCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

        // const rdsSecondaryCluster = new GlobalAuroraRDSSecondary(this, 'ServerlessDbSecondaryCluster', {
        //     vpc: vpcSecondary
        // });

        // Tags.of(rdsSecondaryCluster).add(TagEnum.APPLICATION_ID, appId);
        // Tags.of(rdsSecondaryCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

        // rdsGlobalCluster.addRegionalCluster(this, 'ServerlessDbRegionalCluster', {
        //     region: infrastructureConfig.regions.secondary,
        //     dbSubnetGroupName: rdsSecondaryCluster.dbSubnetGroup.dbSubnetGroupName
        // });

        // // #endregion
    }
}