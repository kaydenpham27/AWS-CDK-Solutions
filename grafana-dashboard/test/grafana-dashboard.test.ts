import * as cdk from "aws-cdk-lib/core";
import { Template, Match, Capture } from "aws-cdk-lib/assertions";
import { GrafanaDashboardStack } from "../lib/grafana-dashboard-stack";

describe("GrafanaDashboardStack", () => {
  let app: cdk.App;
  let stack: GrafanaDashboardStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App({
      context: {
        IAM_IDENTITY_CENTER_INSTANCE_ARN:
          "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        IAM_IDENTITY_CENTER_GROUP_ID: "group-1234567890abcdef",
      },
    });
    stack = new GrafanaDashboardStack(app, "TestStack", {});
    template = Template.fromStack(stack);
  });

  describe("IAM Role", () => {
    test("should create exactly one IAM role", () => {
      template.resourceCountIs("AWS::IAM::Role", 1);
    });

    test("should have correct assume role policy for Grafana", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "grafana.amazonaws.com",
              },
            },
          ],
        },
      });
    });

    test("should have all required managed policies attached", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        ManagedPolicyArns: Match.arrayWith([
          Match.objectLike({
            "Fn::Join": Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp(
                  "service-role/AmazonGrafanaCloudWatchAccess$",
                ),
              ]),
            ]),
          }),
          Match.objectLike({
            "Fn::Join": Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp("AmazonPrometheusFullAccess$"),
              ]),
            ]),
          }),
          Match.objectLike({
            "Fn::Join": Match.arrayWith([
              Match.arrayWith([Match.stringLikeRegexp("AWSXrayFullAccess$")]),
            ]),
          }),
          Match.objectLike({
            "Fn::Join": Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp("AmazonAthenaFullAccess$"),
              ]),
            ]),
          }),
          Match.objectLike({
            "Fn::Join": Match.arrayWith([
              Match.arrayWith([Match.stringLikeRegexp("AmazonSNSFullAccess$")]),
            ]),
          }),
        ]),
      });
    });

    test("should have correct description", () => {
      template.hasResourceProperties("AWS::IAM::Role", {
        Description:
          "This role grants grafana dashboard permissions to access to-be-monitored resources",
      });
    });
  });

  describe("Grafana Workspace", () => {
    test("should create exactly one Grafana workspace", () => {
      template.resourceCountIs("AWS::Grafana::Workspace", 1);
    });

    test("should have correct basic configuration", () => {
      template.hasResourceProperties("AWS::Grafana::Workspace", {
        Description:
          "Dashboard to visualise, monitor and analyse AWS CloudWatch logs",
        AccountAccessType: "CURRENT_ACCOUNT",
        AuthenticationProviders: ["AWS_SSO"],
        PermissionType: "CUSTOMER_MANAGED",
        GrafanaVersion: "10.4",
      });
    });

    test("should reference the IAM role correctly", () => {
      const roleCapture = new Capture();
      template.hasResourceProperties("AWS::Grafana::Workspace", {
        RoleArn: {
          "Fn::GetAtt": [roleCapture, "Arn"],
        },
      });

      // Verify the captured role logical ID matches expected pattern
      expect(roleCapture.asString()).toMatch(/GrafanaDashboardRole/);
    });

    test("should have all required data sources", () => {
      template.hasResourceProperties("AWS::Grafana::Workspace", {
        DataSources: Match.arrayEquals([
          "CLOUDWATCH",
          "PROMETHEUS",
          "XRAY",
          "ATHENA",
        ]),
      });
    });

    test("should not have notification destinations configured", () => {
      template.hasResourceProperties("AWS::Grafana::Workspace", {
        NotificationDestinations: Match.absent(),
      });
    });
  });

  describe("SSO Permission Set", () => {
    test("should create exactly one permission set", () => {
      template.resourceCountIs("AWS::SSO::PermissionSet", 1);
    });

    test("should use correct IAM Identity Center instance ARN from context", () => {
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
      });
    });

    test("should have Admin name", () => {
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        Name: "Admin",
      });
    });

    test("should have AdministratorAccess policy attached", () => {
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        ManagedPolicies: ["arn:aws:iam::aws:policy/AdministratorAccess"],
      });
    });
  });

  describe("SSO Assignment", () => {
    test("should create exactly one SSO assignment", () => {
      template.resourceCountIs("AWS::SSO::Assignment", 1);
    });

    test("should use correct instance ARN and group ID from context", () => {
      template.hasResourceProperties("AWS::SSO::Assignment", {
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        PrincipalId: "group-1234567890abcdef",
        PrincipalType: "GROUP",
      });
    });

    test("should reference the permission set correctly", () => {
      const permissionSetCapture = new Capture();
      template.hasResourceProperties("AWS::SSO::Assignment", {
        PermissionSetArn: {
          "Fn::GetAtt": [permissionSetCapture, "PermissionSetArn"],
        },
      });

      expect(permissionSetCapture.asString()).toMatch(/CfnAdminPermissionSet/);
    });

    test("should target current AWS account", () => {
      template.hasResourceProperties("AWS::SSO::Assignment", {
        TargetType: "AWS_ACCOUNT",
        TargetId: {
          Ref: "AWS::AccountId",
        },
      });
    });
  });

  describe("Resource Dependencies", () => {
    test("should have Grafana workspace depend on IAM role", () => {
      const resources = template.toJSON().Resources;
      const workspaceKey = Object.keys(resources).find(
        (key) => resources[key].Type === "AWS::Grafana::Workspace",
      );
      const roleKey = Object.keys(resources).find(
        (key) => resources[key].Type === "AWS::IAM::Role",
      );

      expect(workspaceKey).toBeDefined();
      expect(roleKey).toBeDefined();

      // Grafana workspace should reference the role
      const workspace = resources[workspaceKey!];
      expect(JSON.stringify(workspace.Properties.RoleArn)).toContain(roleKey!);
    });

    test("should have SSO assignment depend on permission set", () => {
      const resources = template.toJSON().Resources;
      const assignmentKey = Object.keys(resources).find(
        (key) => resources[key].Type === "AWS::SSO::Assignment",
      );
      const permissionSetKey = Object.keys(resources).find(
        (key) => resources[key].Type === "AWS::SSO::PermissionSet",
      );

      expect(assignmentKey).toBeDefined();
      expect(permissionSetKey).toBeDefined();

      const assignment = resources[assignmentKey!];
      expect(JSON.stringify(assignment.Properties.PermissionSetArn)).toContain(
        permissionSetKey!,
      );
    });
  });

  describe("Stack Outputs and Metadata", () => {
    test("should synthesize without errors", () => {
      expect(() => app.synth()).not.toThrow();
    });

    test("should have correct total resource count", () => {
      const resources = template.toJSON().Resources;
      expect(Object.keys(resources).length).toBe(4); // Role, Workspace, PermissionSet, Assignment
    });
  });

  describe("Context Validation", () => {
    test("should throw errors when required context is missing", () => {
      const appWithoutContext = new cdk.App({
        context: {},
      });
      const stackWithoutContext = () =>
        new GrafanaDashboardStack(appWithoutContext, "TestStackNoContext");

      expect(stackWithoutContext).toThrow();
    });
  });

  describe("Stack synthesised template", () => {
    test("matches the snapshot", () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });
});
