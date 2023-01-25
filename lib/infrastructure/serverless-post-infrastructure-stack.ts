import { InfrastructureConfig, TagEnum } from '../../config/InfrastructureConfig';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnGlobalCluster, AuroraPostgresEngineVersion, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { Tags } from 'aws-cdk-lib';

export class ServerlessPostInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const infrastructureConfig = InfrastructureConfig;

        const appId: string = scope.node.tryGetContext('appId');

        // #region Global RDS Cluster

        // const dbEngine = DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_7 });

        // const rdsGlobalCluster = new CfnGlobalCluster(this, 'ServerlessDbGlobalCluster', {
        //     deletionProtection: !infrastructureConfig.isDevTesting,
        //     engine: dbEngine.engineFamily,
        //     // engineVersion: AuroraPostgresEngineVersion.VER_13_7.auroraPostgresMajorVersion,
        //     globalClusterIdentifier: infrastructureConfig.globalDatabaseClusterName,
        //     // sourceDbClusterIdentifier: `arn:aws:rds:${infrastructureConfig.regions.primary}:${this.account}:cluster:${infrastructureConfig.databaseClusterName}`,
        //     storageEncrypted: true
        // });
        // Tags.of(rdsGlobalCluster).add(TagEnum.APPLICATION_ID, appId);
        // Tags.of(rdsGlobalCluster).add(TagEnum.NAME, `${infrastructureConfig.globalDatabaseClusterName}-${appId}-db-global`);

        // #endregion
    }
}