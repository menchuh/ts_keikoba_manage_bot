##################################
# builder
##################################
FROM public.ecr.aws/lambda/nodejs:18

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

RUN cp dist/adminapi/index.js ${LAMBDA_TASK_ROOT}/index.js

CMD ["index.lambdaHandler"]

##################################
# runner
##################################
# FROM public.ecr.aws/lambda/nodejs:18
#
#WORKDIR ${LAMBDA_TASK_ROOT}
#
# COPY --from=builder /usr/app/dist/adminapi ./src/adminapi
# COPY --from=builder /usr/app/dist/manager_bot ./src/manager_bot
# COPY --from=builder /usr/app/dist/notification ./src/notification
#
#COPY --from=builder /usr/app/dist/adminapi/index.js ./
#COPY --from=builder /usr/app/node_modules/ ./
#
#CMD ["index.lambdaHandler"]
