##################################
# builder
##################################
FROM public.ecr.aws/lambda/nodejs:20 as builder

WORKDIR /usr/app

COPY package.json  ./
COPY .yarnrc  ./
COPY yarn.lock  ./
COPY esbuild.ts  ./
COPY src/ ./src/

RUN npm install -g yarn
RUN yarn install
RUN yarn build
    
##################################
# runner
##################################
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/package.json ./
COPY --from=builder /usr/app/dist/adminapi/* ./adminapi/
COPY --from=builder /usr/app/dist/common/* ./common/
COPY --from=builder /usr/app/dist/manager_bot/* ./manager_bot/
COPY --from=builder /usr/app/dist/notification/* ./notification/
