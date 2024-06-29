rm ./doc/api.html
redocly lint ./doc/api.yaml
redocly build-docs ./doc/api.yaml -o ./doc/api.html
