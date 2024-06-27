##################################
# builder
##################################
FROM public.ecr.aws/lambda/nodejs:18 as builder

WORKDIR /usr/app

COPY package.json  ./
COPY yarn.lock  ./
COPY esbuild.js  ./
COPY src/adminapi/ ./adminapi/
COPY src/common/ ./common/
COPY src/manager_bot/ ./manager_bot/
COPY src/notification/ ./notification/

RUN npm install -g yarn
RUN yarn install
RUN yarn build

RUN echo $(ls)
RUN echo $(ls dist)
    
##################################
# runner
##################################
FROM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/dist/* ./

CMD ["index.lambdaHandler"]
