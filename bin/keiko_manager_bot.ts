#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { KeikoManagerBotStack } from '../lib/keiko_manager_bot-stack'

const app = new cdk.App()
new KeikoManagerBotStack(app, 'KeikoManagerBotStack', {})
