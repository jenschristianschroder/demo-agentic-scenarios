@description('Azure region')
param location string

@description('Managed Identity name')
param name string

@description('ACR resource ID for AcrPull role assignment')
param acrId string

@description('Azure OpenAI resource ID for role assignment')
param openAIId string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: name
  location: location
}

// ─── ACR Pull ────────────────────────────────────────────────────────────────

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, identity.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: last(split(acrId, '/'))
}

// ─── OpenAI Cognitive Services User ──────────────────────────────────────────

resource openAIRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAIId, identity.id, 'a97b65f3-24c7-4388-baec-2e87135dc908')
  scope: openai
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource openai 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: last(split(openAIId, '/'))
}

output id string = identity.id
output clientId string = identity.properties.clientId
