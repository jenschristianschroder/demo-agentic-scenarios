@description('Azure region')
param location string

@description('AI Search service name')
param name string

@description('Search index name')
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
    disableLocalAuth: true
    semanticSearch: 'standard'
  }
}

output id string = search.id
output endpoint string = 'https://${search.name}.search.windows.net'
output indexName string = indexName
