#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { GrafanaDashboardStack } from "../lib/grafana-dashboard-stack";

const app = new cdk.App();
new GrafanaDashboardStack(app, "GrafanaDashboardStack", {});
