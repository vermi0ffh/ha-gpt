#!make
-include build.env

.PHONY: build run

build:
	docker build --build-arg BUILD_FROM="homeassistant/amd64-base:latest" -t local/ha-gpt ./ha-gpt
	docker run --rm --privileged -v ./ha-gpt:/data homeassistant/amd64-builder \
	 --armv7 --amd64 --docker-user $(DOCKER_HUB_USER) --docker-password $(DOCKER_HUB_PASS) -t /data

run:
	mkdir -p /tmp/my_test_data && touch /tmp/my_test_data/options.json
	docker build --build-arg BUILD_FROM="homeassistant/amd64-base:latest" -t local/ha-gpt ./ha-gpt
	docker run --rm -v /tmp/my_test_data:/data local/ha-gpt

