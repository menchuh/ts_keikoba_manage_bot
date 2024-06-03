import {
    Duration,
    Stack,
    StackProps,
    aws_apigateway,
    aws_events,
    aws_events_targets,
    aws_lambda_nodejs,
} from 'aws-cdk-lib'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export class KeikoManagerBotStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

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
        // IAM Role
        //============================================

        //============================================
        // Lambda Functions
        //============================================
        // Function #1
        const adminApiFuncName = 'KeikobaManagerBot_AdminApi'
        const adminApiFuncResource = new aws_lambda_nodejs.NodejsFunction(
            this,
            adminApiFuncName,
            {
                runtime: Runtime.NODEJS_18_X,
                functionName: adminApiFuncName,
                entry: 'src/adminapi/index.ts',
                timeout: Duration.seconds(10),
                logRetention: 30,
                architecture: Architecture.ARM_64,
                handler: 'lambdaHandler',
            }
        )

        // Function #2
        const lineManagerBotFuncName = 'KeikobaManagerBot_LineManagerBot'
        const lineManagerBotFuncResource = new aws_lambda_nodejs.NodejsFunction(
            this,
            lineManagerBotFuncName,
            {
                runtime: Runtime.NODEJS_18_X,
                functionName: lineManagerBotFuncName,
                entry: 'src/manager_bot/index.ts',
                timeout: Duration.seconds(10),
                logRetention: 30,
                architecture: Architecture.ARM_64,
                handler: 'lambdaHandler',
            }
        )

        // Function #3
        const lineNotificationFuncName = 'KeikobaManagerBot_LineNotification'
        const lineNotificationFunResource =
            new aws_lambda_nodejs.NodejsFunction(
                this,
                lineNotificationFuncName,
                {
                    runtime: Runtime.NODEJS_18_X,
                    functionName: lineNotificationFuncName,
                    entry: 'src/notification/index.ts',
                    timeout: Duration.seconds(10),
                    logRetention: 30,
                    architecture: Architecture.ARM_64,
                    handler: 'lambdaHandler',
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
                    lineNotificationFunResource
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
