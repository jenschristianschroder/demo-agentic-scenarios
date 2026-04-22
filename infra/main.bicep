targetScope = 'resourceGroup'

// ─── Parameters ──────────────────────────────────────────────────────────────

@description('Azure region for all resources (defaults to resource group location)')
param location string = resourceGroup().location

@description('Base name used to derive resource names')
param appName string = 'multi-agent'

@description('Azure OpenAI model deployment name')
param openAIDeployment string = 'gpt-4o'

@description('Azure region for OpenAI (must support gpt-4o GlobalStandard)')
param openAILocation string = 'swedencentral'

@description('Azure AI Search index name')
param searchIndex string = 'knowledge-base'

@description('Container image tag (typically the git SHA)')
param imageTag string

// ─── Derived names ───────────────────────────────────────────────────────────

var acrName = '${replace('${appName}acr', '-', '')}${uniqueString(resourceGroup().id)}'
var envName = '${appName}-env'
var identityName = '${appName}-identity'
var apiAppName = '${appName}-api'
var spaAppName = '${appName}-spa'
var openAIName = '${appName}-openai-${uniqueString(resourceGroup().id)}'
var searchName = '${appName}-search-${uniqueString(resourceGroup().id)}'

// ─── Modules ─────────────────────────────────────────────────────────────────

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    location: location
    name: acrName
  }
}

module environment 'modules/aca-environment.bicep' = {
  name: 'aca-environment'
  params: {
    location: location
    name: envName
  }
}

module openai 'modules/openai.bicep' = {
  name: 'openai'
  params: {
    location: openAILocation
    name: openAIName
    deploymentName: openAIDeployment
  }
}

module search 'modules/search.bicep' = {
  name: 'search'
  params: {
    location: location
    name: searchName
    indexName: searchIndex
  }
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    name: identityName
    acrId: acr.outputs.id
    openAIId: openai.outputs.id
    searchId: search.outputs.id
  }
}

module apiApp 'modules/aca-api.bicep' = {
  name: 'aca-api'
  params: {
    location: location
    name: apiAppName
    environmentId: environment.outputs.id
    containerImage: '${acr.outputs.loginServer}/${apiAppName}:${imageTag}'
    identityId: identity.outputs.id
    identityClientId: identity.outputs.clientId
    openAIEndpoint: openai.outputs.endpoint
    openAIDeployment: openAIDeployment
    searchEndpoint: search.outputs.endpoint
    searchIndex: searchIndex
    acrLoginServer: acr.outputs.loginServer
  }
}

module spaApp 'modules/aca-spa.bicep' = {
  name: 'aca-spa'
  params: {
    location: location
    name: spaAppName
    environmentId: environment.outputs.id
    containerImage: '${acr.outputs.loginServer}/${spaAppName}:${imageTag}'
    apiBackendUrl: 'http://${apiAppName}'
    acrLoginServer: acr.outputs.loginServer
    identityId: identity.outputs.id
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

@description('Public URL of the SPA')
output spaUrl string = 'https://${spaApp.outputs.fqdn}'

@description('ACR login server')
output acrLoginServer string = acr.outputs.loginServer
