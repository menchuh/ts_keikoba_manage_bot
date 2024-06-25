##################################
# builder
##################################
FROM public.ecr.aws/lambda/nodejs:18 as builder

WORKDIR /usr/app

# Copy files
COPY package.json ./
COPY yarn.lock ./
COPY esbuild.js ./
COPY src/ ./src/

# install node_modules
RUN npm install -g yarn
RUN yarn install

# build sources
RUN yarn build

##################################
# runner
##################################
FROM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /usr/app/dist/adminapi ./adminapi
COPY --from=builder /usr/app/dist/manager_bot ./manager_bot
COPY --from=builder /usr/app/dist/notification ./notification
