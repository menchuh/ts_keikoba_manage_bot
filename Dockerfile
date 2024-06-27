##################################
# builder
##################################
FROM public.ecr.aws/lambda/nodejs:18 as builder

WORKDIR /usr/app

COPY package.json  ./
COPY yarn.lock  ./
COPY esbuild.js  ./
COPY src/adminapi ./

RUN echo $(ls)

RUN npm install -g yarn
RUN yarn install
RUN yarn build
    
##################################
# runner
##################################
FROM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/dist/adminapi/* ./

CMD ["index.handler"]
