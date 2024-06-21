import {
    Duration,
    Stack,
    StackProps,
    aws_apigateway,
    aws_events,
    aws_events_targets,
    aws_ecr,
    aws_lambda,
} from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
    Effect,
    ManagedPolicy,
    PolicyStatement,
    Role,
} from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { Architecture } from 'aws-cdk-lib/aws-lambda'

export class KeikoManagerBotStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        // AWS情報
        const accountId = Stack.of(this).account
        const tokyoRegion = 'ap-northeast-1'
        const repositoryName = 'keikoba_maanagebot_ts_repo'
        const initialImageTag = 'initial'

        //============================================
        // API Gateway
        //============================================
        // API Gateway RestAPIの作成
        // Admin APIの作成
        const restApiAdminApiName = 'KeikoManagerBotAdmin'
        const restApiAdminApi = new aws_apigateway.RestApi(
            this,
            restApiAdminApiName,
            {
                restApiName: restApiAdminApiName,
                deployOptions: {
                    stageName: 'v1',
                },
                defaultMethodOptions: {
                    apiKeyRequired: true,
                },
            }
        )

        // LINE Bot用 RestAPIの作成
        const restApiMessageApiName = 'KeikoManagerBot'
        const restApiMessageApi = new aws_apigateway.RestApi(
            this,
            restApiMessageApiName,
            {
                restApiName: restApiMessageApiName,
                deployOptions: {
                    stageName: 'v1',
                },
            }
        )

        // リソースの追加
        const restApiAdminGroups = restApiAdminApi.root.addResource('groups')
        const restApiAdminGroupsId = restApiAdminGroups.addResource('{id}')
        const restApiAdminPractices =
            restApiAdminApi.root.addResource('practices')
        const restApiAdminPracticesId =
            restApiAdminPractices.addResource('{id}')

        const restApiMessage = restApiMessageApi.root.addResource('messages')

        //============================================
        // Lambda Functions
        //============================================
        // Function #1
        const adminApiFuncName = 'KeikobaManagerBot_AdminApi'
        const adminApiFuncResource = new aws_lambda.DockerImageFunction(
            this,
            adminApiFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(
                    aws_ecr.Repository.fromRepositoryName(
                        this,
                        `${repositoryName}-${adminApiFuncName}`,
                        repositoryName
                    ),
                    {
                        cmd: ['src/adminapi/index.lambdaHandler'],
                        tagOrDigest: initialImageTag,
                    }
                ),
                functionName: adminApiFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
                architecture: Architecture.ARM_64,
            }
        )

        // Function #2
        const lineManagerBotFuncName = 'KeikobaManagerBot_LineManagerBot'
        const lineManagerBotFuncResource = new aws_lambda.DockerImageFunction(
            this,
            lineManagerBotFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(
                    aws_ecr.Repository.fromRepositoryName(
                        this,
                        `${repositoryName}-${lineManagerBotFuncName}`,
                        repositoryName
                    ),
                    {
                        cmd: ['src/adminapi/index.lambdaHandler'],
                        tagOrDigest: initialImageTag,
                    }
                ),
                functionName: lineManagerBotFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
                architecture: Architecture.ARM_64,
            }
        )

        // Function #3
        const lineNotificationFuncName = 'KeikobaManagerBot_LineNotification'
        const lineNotificationFuncResource = new aws_lambda.DockerImageFunction(
            this,
            lineNotificationFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(
                    aws_ecr.Repository.fromRepositoryName(
                        this,
                        `${repositoryName}-${lineNotificationFuncName}`,
                        repositoryName
                    ),
                    {
                        cmd: ['src/adminapi/index.lambdaHandler'],
                        tagOrDigest: initialImageTag,
                    }
                ),
                functionName: lineNotificationFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
                architecture: Architecture.ARM_64,
            }
        )

        //============================================
        // CloudWatch Trigger
        //============================================
        const cloudWatchEventName = 'EveryDayPM9_Execution'
        new aws_events.Rule(this, cloudWatchEventName, {
            enabled: true,
            ruleName: cloudWatchEventName,
            schedule: aws_events.Schedule.cron({
                year: '*',
                month: '*',
                day: '*',
                hour: '12',
                minute: '0',
            }),
            targets: [
                new aws_events_targets.LambdaFunction(
                    lineNotificationFuncResource
                ),
            ],
        })

        //============================================
        // IAM Role
        //============================================
        // ポリシーの生成
        // DynamoDB
        const listAndDescribeDynaoDBPolicyStatement = new PolicyStatement({
            actions: [
                'dynamodb:List*',
                'dynamodb:DescribeReservedCapacity*',
                'dynamodb:DescribeLimits',
                'dynamodb:DescribeTimeToLive',
            ],
            effect: Effect.ALLOW,
            resources: ['*'],
        })
        const accessDynamoDBPolicyStatement = new PolicyStatement({
            actions: [
                'dynamodb:DescribeTable',
                'dynamodb:Get*',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:DeleteItem',
                'dynamodb:UpdateItem',
                'dynamodb:PutItem',
            ],
            effect: Effect.ALLOW,
            resources: [
                `arn:aws:dynamodb:${tokyoRegion}:${accountId}:table/keikoba_practices`,
                `arn:aws:dynamodb:${tokyoRegion}:${accountId}:table/keikoba_users_groups`,
            ],
        })

        // S3
        const listS3PolicyStatement = new PolicyStatement({
            actions: ['s3:ListBucket'],
            effect: Effect.ALLOW,
            resources: ['arn:aws:s3:::isshou-keikoba-bot-logs'],
        })
        const operateS3PolicyStatement = new PolicyStatement({
            actions: ['s3:GetObject', 's3:PutObject'],
            effect: Effect.ALLOW,
            resources: ['arn:aws:s3:::isshou-keikoba-bot-logs'],
        })

        // ポリシーのアタッチ
        const admnApiLambdaRole = adminApiFuncResource.role as Role
        const lineManagerBotLambdaRole = lineManagerBotFuncResource.role as Role
        const lineNoficationLambdaRole =
            lineNotificationFuncResource.role as Role

        // DynamoDB
        admnApiLambdaRole.addToPolicy(listAndDescribeDynaoDBPolicyStatement)
        admnApiLambdaRole.addToPolicy(accessDynamoDBPolicyStatement)
        lineManagerBotLambdaRole.addToPolicy(
            listAndDescribeDynaoDBPolicyStatement
        )
        lineManagerBotLambdaRole.addToPolicy(accessDynamoDBPolicyStatement)
        lineNoficationLambdaRole.addToPolicy(
            listAndDescribeDynaoDBPolicyStatement
        )
        lineNoficationLambdaRole.addToPolicy(accessDynamoDBPolicyStatement)

        // SSM
        admnApiLambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess')
        )
        lineManagerBotLambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess')
        )
        lineNoficationLambdaRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess')
        )

        // S3
        admnApiLambdaRole.addToPolicy(listS3PolicyStatement)
        admnApiLambdaRole.addToPolicy(operateS3PolicyStatement)
        lineManagerBotLambdaRole.addToPolicy(listS3PolicyStatement)
        lineManagerBotLambdaRole.addToPolicy(operateS3PolicyStatement)
        lineNoficationLambdaRole.addToPolicy(listS3PolicyStatement)
        lineNoficationLambdaRole.addToPolicy(operateS3PolicyStatement)

        //============================================
        // Lambda Proxy Integration
        //============================================
        restApiMessage.addMethod(
            'POST',
            new aws_apigateway.LambdaIntegration(lineManagerBotFuncResource)
        )

        restApiAdminGroups.addMethod(
            'GET',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminGroups.addMethod(
            'POST',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminGroupsId.addMethod(
            'GET',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminGroupsId.addMethod(
            'PUT',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminPracticesId.addMethod(
            'DELETE',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminPracticesId.addMethod(
            'GET',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )
        restApiAdminPracticesId.addMethod(
            'POST',
            new aws_apigateway.LambdaIntegration(adminApiFuncResource)
        )

        //============================================
        // API Key
        //============================================
        const apiKeyName = 'keikobaManagerBotAdminAPIKey'
        const apiKey = new aws_apigateway.ApiKey(this, apiKeyName, {
            apiKeyName: apiKeyName,
        })
        const usagePlanName = 'keikobaManagerBotAdminUsagePlan'
        const plan = new aws_apigateway.UsagePlan(this, usagePlanName, {
            name: usagePlanName,
        })
        plan.addApiKey(apiKey)
        plan.addApiStage({ stage: restApiAdminApi.deploymentStage })
    }
}
