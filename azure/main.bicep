@description('MySQL + API region. eastus2 is often blocked for MySQL on some subscriptions; default is westus2.')
param location string = 'westus2'

@description('Static Web Apps Free: westus2, centralus, eastus2, westeurope, eastasia only.')
param staticWebAppLocation string = 'westus2'

@description('Short base name; combined with a hash for globally unique hostnames.')
param baseName string

@secure()
@minLength(8)
param mysqlAdminPassword string

param extraCorsOrigins string = ''
param devClientIp string = ''

@description('If your subscription already has a Container Apps environment in this region (limit: 1), paste its full resource ID here and the template will not create a new Log Analytics / environment.')
param existingContainerAppEnvironmentId string = ''

// Stable per RG + baseName so redeploys update the same MySQL/ACR/env (not a new env every deployment — subs allow only 1 env per region).
var unique = uniqueString(resourceGroup().id, baseName)
var useExistingContainerEnv = length(trim(existingContainerAppEnvironmentId)) > 0
var mysqlServerName = toLower('${take(replace(baseName, '-', ''), 10)}mysql${take(unique, 6)}')
var mysqlDbName = 'ai_testing_shop'
var staticWebAppName = toLower('${take(replace(baseName, '-', ''), 12)}-web-${take(unique, 8)}')
var acrName = toLower('${take(replace(baseName, '-', ''), 8)}acr${take(unique, 8)}')
var logAnalyticsName = toLower('logs-${take(unique, 10)}')
var containerEnvName = toLower('env-${take(unique, 10)}')
var containerAppName = toLower('${take(replace(baseName, '-', ''), 10)}-api-${take(unique, 6)}')

resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2023-06-30' = {
  name: mysqlServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'shopadmin'
    administratorLoginPassword: mysqlAdminPassword
    version: '8.0.21'
    storage: {
      autoGrow: 'Enabled'
      iops: 360
      storageSizeGB: 20
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource firewallAzure 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-06-30' = {
  parent: mysqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource firewallDev 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-06-30' = if (length(trim(devClientIp)) > 0) {
  parent: mysqlServer
  name: 'DevSeedClient'
  properties: {
    startIpAddress: devClientIp
    endIpAddress: devClientIp
  }
}

resource mysqlDatabase 'Microsoft.DBforMySQL/flexibleServers/databases@2023-06-30' = {
  parent: mysqlServer
  name: mysqlDbName
  properties: {
    charset: 'utf8mb4'
    collation: 'utf8mb4_unicode_ci'
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

var staticOrigin = 'https://${staticWebApp.properties.defaultHostname}'
var corsOrigins = length(trim(extraCorsOrigins)) > 0 ? '${staticOrigin},${extraCorsOrigins}' : staticOrigin

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = if (!useExistingContainerEnv) {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = if (!useExistingContainerEnv) {
  name: containerEnvName
  location: location
  properties: {
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics!.properties.customerId
        sharedKey: logAnalytics!.listKeys().primarySharedKey
      }
    }
  }
}

output mysqlServerFqdn string = mysqlServer.properties.fullyQualifiedDomainName
output mysqlDatabaseName string = mysqlDbName
output staticWebAppUrl string = staticOrigin
output staticWebAppNameOut string = staticWebApp.name
output corsOriginsConfigured string = corsOrigins
output apiHostingKind string = 'containerapp'
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output containerAppEnvironmentId string = useExistingContainerEnv ? '' : containerAppEnv!.id
output containerAppNameOut string = containerAppName
output apiUrl string = ''
