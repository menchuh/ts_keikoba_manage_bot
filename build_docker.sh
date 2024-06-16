#!/bin/bash

ACCOUNT_ID=${1}
REGION=${2}
ECR_REPO_NAME=${3}
INITIAL_TAG="initial"

ECR_REPO_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "ECR_REPO_URI: ${ECR_REPO_URI}"

aws ecr get-login-password | docker login --username AWS --password-stdin "https://${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "docker build..."

docker image build . -t ${ECR_REPO_NAME}  --no-cache --progress=plain
docker tag ${ECR_REPO_NAME}:${INITIAL_TAG} ${ECR_REPO_URI}:${INITIAL_TAG}

echo "docker push..."

docker push ${ECR_REPO_URI}:${INITIAL_TAG}
