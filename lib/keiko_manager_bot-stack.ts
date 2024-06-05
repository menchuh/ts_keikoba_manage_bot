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
import { Construct } from 'constructs'
import * as imagedeploy from 'cdk-docker-image-deployment'
import path from 'path'
import { ulid } from 'ulid'

export class KeikoManagerBotStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        // Dockerイメージに付するタグ
        const dockerImageTag = ulid()

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
        // Elastic Container Registry
        //============================================
        // Create ECR Repository
        const repositoryPrefix = 'KeikobaManageBot'
        const ecrRepository = new aws_ecr.Repository(
            this,
            `${repositoryPrefix}-ts`,
            {
                imageScanOnPush: true,
                repositoryName: `${repositoryPrefix}-ts-repo`,
                lifecycleRules: [
                    {
                        description: 'Repository for Keikoba Manage bot image.',
                        maxImageCount: 5, // 5世代まで保持
                    },
                ],
            }
        )

        // Create and push Docker image
        const imageDeployment = 'KeikobaManageBotDockerImageDeploy'
        new imagedeploy.DockerImageDeployment(this, imageDeployment, {
            source: imagedeploy.Source.directory(path.join(__dirname, '..')),
            destination: imagedeploy.Destination.ecr(ecrRepository, {
                tag: dockerImageTag,
            }),
        })

        //============================================
        // Lambda Functions
        //============================================
        // Function #1
        const adminApiFuncName = 'KeikobaManagerBot_AdminApi'
        const adminApiFuncResource = new aws_lambda.DockerImageFunction(
            this,
            adminApiFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(ecrRepository, {
                    cmd: ['src/adminapi/index.lambdaHandler'],
                    tagOrDigest: dockerImageTag,
                }),
                functionName: adminApiFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
            }
        )

        // Function #2
        const lineManagerBotFuncName = 'KeikobaManagerBot_LineManagerBot'
        const lineManagerBotFuncResource = new aws_lambda.DockerImageFunction(
            this,
            lineManagerBotFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(ecrRepository, {
                    cmd: ['src/manager_bot/index.lambdaHandler'],
                    tagOrDigest: dockerImageTag,
                }),
                functionName: lineManagerBotFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
            }
        )

        // Function #3
        const lineNotificationFuncName = 'KeikobaManagerBot_LineNotification'
        const lineNotificationFuncResource = new aws_lambda.DockerImageFunction(
            this,
            lineNotificationFuncName,
            {
                code: aws_lambda.DockerImageCode.fromEcr(ecrRepository, {
                    cmd: ['src/notification/index.lambdaHandler'],
                    tagOrDigest: dockerImageTag,
                }),
                functionName: lineNotificationFuncName,
                logRetention: RetentionDays.ONE_MONTH,
                timeout: Duration.seconds(10),
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
                weekDay: '*',
            }),
            targets: [
                new aws_events_targets.LambdaFunction(
                    lineNotificationFuncResource
                ),
            ],
        })

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
    }
}
