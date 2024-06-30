# Keiko Manager Bot (Typescript)

## Overview

This project is a TypeScript version of a training scheduling bot.

## Description

This program will run on AWS. Specifically, a Docker container image runs on AWS Lambda; Lambda functions are invoked by API calls or scheduled batches.  
The infrastructure is deployed using CDK (written in TypeScript) and the push to the container image to the ECR is done via GitHub Actions, except the first time (first time is a Bash script).

## Tools

-   Iac: AWS CDK
-   Build: [esbuild](https://esbuild.github.io/)
-   CI/CD: GitHub Actions
-   API Doc: [Swagger](https://swagger.io/)
-   Package Manager: [yarn](https://yarnpkg.com/)
-   Format: [Prettier](https://prettier.io/)
-   Test: [Vitest](https://vitest.dev/)

## commands

-   `yarn build` compile typescript to js
-   `yarn cdk:deploy` deploy AWS resources via AWS CDK
-   `yarn cdk:diff` show the differences on AWS resources because of stack changes
-   `yarn cdk:synth` cdk synth command
-   `yarn cdk:destory` cdk destory command
-   `yarn gen:apidoc` generate api doc with shell script
-   `yarn lint` lint the TypeScript files
-   `yarn test` run the unit tests for the TypeScript files(not yet)

## Translated

Translated with DeepL.com (free version)
