@description('Azure region')
param location string

@description('Azure AI Search service name')
param name string

@description('Default index name')
param indexName string

resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: name
  location: location
  sku: {
    name: 'basic'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

// Note: The search index must be created at application level (not via Bicep).
// The indexName parameter is passed through to the API container environment.

output id string = search.id
output endpoint string = 'https://${search.name}.search.windows.net'
output indexName string = indexName
