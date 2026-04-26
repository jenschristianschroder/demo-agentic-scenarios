@description('Azure region')
param location string

@description('Container App name')
param name string

@description('Container Apps Environment resource ID')
param environmentId string

@description('Container image reference')
param containerImage string

@description('Managed Identity resource ID')
param identityId string

@description('Managed Identity client ID')
param identityClientId string

@description('Azure OpenAI endpoint URL')
param openAIEndpoint string

@description('Azure OpenAI deployment name')
param openAIDeployment string

@description('Azure AI Search endpoint URL')
param searchEndpoint string

@description('Azure AI Search index name')
param searchIndex string

@description('ACR login server')
param acrLoginServer string

@description('Tavily Search API key for the web_search tool (optional)')
@secure()
param tavilyApiKey string = ''

@description('Azure OpenAI reasoning model deployment name (optional)')
param openAIReasoningDeployment string = ''

resource apiApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: false
        targetPort: 3001
        transport: 'http'
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
      secrets: empty(tavilyApiKey) ? [] : [
        { name: 'tavily-api-key', value: tavilyApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'PORT', value: '3001' }
            { name: 'AZURE_CLIENT_ID', value: identityClientId }
            { name: 'AZURE_OPENAI_ENDPOINT', value: openAIEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: openAIDeployment }
            { name: 'AZURE_SEARCH_ENDPOINT', value: searchEndpoint }
            { name: 'AZURE_SEARCH_INDEX', value: searchIndex }
            { name: 'CORS_ORIGIN', value: '*' }
            ...(empty(openAIReasoningDeployment) ? [] : [{ name: 'AZURE_OPENAI_REASONING_DEPLOYMENT', value: openAIReasoningDeployment }])
            ...(empty(tavilyApiKey) ? [] : [{ name: 'TAVILY_API_KEY', secretRef: 'tavily-api-key' }])
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output fqdn string = apiApp.properties.configuration.ingress.fqdn
