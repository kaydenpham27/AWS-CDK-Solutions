import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as grafana from "aws-cdk-lib/aws-grafana";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sso from "aws-cdk-lib/aws-sso";

export class GrafanaDashboardStack extends cdk.Stack {
  private cfnDashboardWorkspace: grafana.CfnWorkspace;
  private dashboardRole: iam.Role;
  private cfnAdminPermissionSet: sso.CfnPermissionSet;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NOTE: Use this when choosing CUSTOMER_MANAGED as permission type
    this.dashboardRole = new iam.Role(this, "GrafanaDashboardRole", {
      assumedBy: iam.ServicePrincipal.fromStaticServicePrincipleName(
        "grafana.amazonaws.com",
      ),
      description: `This role grants grafana dashboard permissions to access to-be-monitored resources`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonGrafanaCloudWatchAccess",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSNSFullAccess"),
      ],
    });

    this.cfnDashboardWorkspace = new grafana.CfnWorkspace(
      this,
      "CfnDashboardWorkspace",
      {
        description: `Dashboard to visualise, monitor and analyse AWS CloudWatch logs`,
        accountAccessType: "CURRENT_ACCOUNT",
        authenticationProviders: ["AWS_SSO"],
        permissionType: "SERVICE_MANAGED",
        // roleArn: this.dashboardRole.roleArn,
        grafanaVersion: "10.4",
        dataSources: ["CLOUDWATCH", "PROMETHEUS", "XRAY", "ATHENA"],
      },
    );

    // Permission set to be granted to an USER or a GROUP in IAM Identity Center (IAM SSO)
    this.cfnAdminPermissionSet = new sso.CfnPermissionSet(
      this,
      "CfnAdminPermissionSet",
      {
        instanceArn: this.node.tryGetContext(
          "IAM_IDENTITY_CENTER_INSTANCE_ARN",
        ),
        name: "Admin",
        managedPolicies: ["arn:aws:iam::aws:policy/AdministratorAccess"],
      },
    );

    // Granting the permission set to a GROUP
    const permissionsSetAssignment = new sso.CfnAssignment(
      this,
      "PermissionsSetAssignment",
      {
        instanceArn: this.node.tryGetContext(
          "IAM_IDENTITY_CENTER_INSTANCE_ARN",
        ),
        permissionSetArn: this.cfnAdminPermissionSet.attrPermissionSetArn,
        principalType: "GROUP",
        principalId: this.node.tryGetContext("IAM_IDENTITY_CENTER_GROUP_ID"),
        targetType: "AWS_ACCOUNT",
        targetId: this.account,
      },
    );
  }
}
