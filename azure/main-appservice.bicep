@description('Region for MySQL Flexible Server and App Service.')
param location string = 'westus2'

@description('Region for Static Web Apps (Free tier). Allowed: westus2, centralus, eastus2, westeurope, eastasia.')
param staticWebAppLocation string = 'westus2'

@description('Short base name; combined with a hash for globally unique hostnames.')
param baseName string

@secure()
@minLength(8)
param mysqlAdminPassword string

@secure()
@minLength(16)
param adminJwtSecret string

param extraCorsOrigins string = ''
param devClientIp string = ''

@allowed(['F1', 'B1'])
param appServiceSku string = 'F1'

var appServiceSkuTier = appServiceSku == 'F1' ? 'Free' : 'Basic'

var unique = uniqueString(resourceGroup().id, baseName)
var mysqlServerName = toLower('${take(replace(baseName, '-', ''), 10)}mysql${take(unique, 6)}')
var mysqlDbName = 'ai_testing_shop'
var webAppName = toLower('${take(replace(baseName, '-', ''), 12)}-api-${take(unique, 8)}')
var planName = toLower('${take(replace(baseName, '-', ''), 12)}-plan')
var staticWebAppName = toLower('${take(replace(baseName, '-', ''), 12)}-web-${take(unique, 8)}')

var databaseUrl = 'mysql://shopadmin:${mysqlAdminPassword}@${mysqlServer.properties.fullyQualifiedDomainName}:3306/${mysqlDbName}?sslaccept=strict'

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

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSku
    tier: appServiceSkuTier
  }
  properties: {
    reserved: true
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

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npm run start:azure'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'DATABASE_URL'
          value: databaseUrl
        }
        {
          name: 'ADMIN_JWT_SECRET'
          value: adminJwtSecret
        }
        {
          name: 'CORS_ORIGINS'
          value: corsOrigins
        }
      ]
    }
  }
  dependsOn: [
    mysqlDatabase
    firewallAzure
  ]
}

output mysqlServerFqdn string = mysqlServer.properties.fullyQualifiedDomainName
output mysqlDatabaseName string = mysqlDbName
output apiUrl string = 'https://${webApp.properties.defaultHostName}'
output staticWebAppUrl string = staticOrigin
output webAppNameOut string = webApp.name
output staticWebAppNameOut string = staticWebApp.name
output corsOriginsConfigured string = corsOrigins
output apiHostingKind string = 'appservice'
