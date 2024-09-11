# Learn Docker Template

## Requirement

- nvm
- nodejs v20.16.0
- yarn
- docker

## Cloning

`git clone https://github.com/deckyfx/learn-docker.git`
or `git clone git@github.com:deckyfx/learn-docker.git`

Make sure nvm is installed, and install node version `20.16.0`, visit [https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm) for more detail

Set node version

`nvm use`

Check node version

`node --version`

it should return

`v20.16.0`

Make sure yarn is installed, if not use

`npm install --global yarn`

Install dependecies

`yarn install`

## Run development docker

`docker compose -f docker-compose.dev.yml up`

## watch changes

`docker compose -f docker-compose.dev.yml --build`

## Detach mode don't watch changes

`docker compose -f docker-compose.dev.yml --build -d`

## Get all docker running

`docker ps`

## Enter docker shell

`docker exec -it <name> sh`

## Run docker

`docker compose up`
