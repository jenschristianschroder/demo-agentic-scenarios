@description('Azure region')
param location string

@description('Container Apps Environment name')
param name string

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: name
  location: location
  properties: {}
}

output id string = environment.id
