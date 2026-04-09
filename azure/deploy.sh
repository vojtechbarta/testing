#!/usr/bin/env bash
# Provision MySQL, Static Web App, and API on Azure Container Apps (default) or App Service.
# Requires: Azure CLI (`az login`). Container path also uses `az acr build` and the containerapp extension.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RG="${AZURE_RG:-rg-ai-testing-shop}"
LOCATION="${AZURE_LOCATION:-westus2}"
SWA_LOCATION="${AZURE_SWA_LOCATION:-$LOCATION}"
BASE_NAME="${1:-aitshop}"

# containerapp = no App Service quota needed (uses ACR + Container Apps). appservice = F1/B1 App Service plan.
API_HOSTING="${AZURE_API_HOSTING:-containerapp}"

_swa_allowed='westus2 centralus eastus2 westeurope eastasia'
if ! echo " $_swa_allowed " | grep -q " $SWA_LOCATION "; then
  echo "ERROR: Static Web Apps (Free) cannot be created in '$SWA_LOCATION'." >&2
  echo "Set AZURE_SWA_LOCATION to one of: $_swa_allowed" >&2
  exit 1
fi

MYSQL_PASS="${MYSQL_ADMIN_PASSWORD:-$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)}"
JWT_SECRET="${ADMIN_JWT_SECRET:-$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)}"
DEV_IP="${DEV_CLIENT_IP:-}"

if [[ "$API_HOSTING" == "appservice" ]]; then
  APP_SKU="${AZURE_APP_SERVICE_SKU:-F1}"
  if [[ "$APP_SKU" != "F1" && "$APP_SKU" != "B1" ]]; then
    echo "ERROR: AZURE_APP_SERVICE_SKU must be F1 or B1, got: $APP_SKU" >&2
    exit 1
  fi
fi

echo "Resource group: $RG (metadata location: $LOCATION)"
echo "MySQL + API compute region: $LOCATION"
echo "Static Web App region: $SWA_LOCATION"
echo "API hosting: $API_HOSTING"
[[ "$API_HOSTING" == "appservice" ]] && echo "App Service plan SKU: $APP_SKU"
echo "Base name: $BASE_NAME"

az group create --name "$RG" --location "$LOCATION" >/dev/null

echo "Registering resource providers (Microsoft.App, ACR, MySQL, …)…"
for ns in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforMySQL Microsoft.OperationalInsights Microsoft.Web; do
  az provider register -n "$ns" >/dev/null 2>&1 || true
done

if [[ "$API_HOSTING" == "appservice" ]]; then
  BICEP_FILE="$ROOT/azure/main-appservice.bicep"
else
  BICEP_FILE="$ROOT/azure/main.bicep"
fi

DEPLOY_ARGS=(
  --resource-group "$RG"
  --template-file "$BICEP_FILE"
  --parameters "location=$LOCATION"
  --parameters "staticWebAppLocation=$SWA_LOCATION"
  --parameters "baseName=$BASE_NAME"
  --parameters "mysqlAdminPassword=$MYSQL_PASS"
)

if [[ "$API_HOSTING" == "appservice" ]]; then
  DEPLOY_ARGS+=(--parameters "adminJwtSecret=$JWT_SECRET")
  DEPLOY_ARGS+=(--parameters "appServiceSku=$APP_SKU")
fi

if [[ -n "$DEV_IP" ]]; then
  DEPLOY_ARGS+=(--parameters "devClientIp=$DEV_IP")
fi

# Reuse an existing Container Apps managed environment (subscription limit: 1 per region).
if [[ "$API_HOSTING" != "appservice" && -n "${AZURE_EXISTING_CONTAINER_ENV_ID:-}" ]]; then
  DEPLOY_ARGS+=(--parameters "existingContainerAppEnvironmentId=${AZURE_EXISTING_CONTAINER_ENV_ID}")
fi

DEPLOY_NAME="shop-$(date +%s)"
echo "Deploying Bicep as $DEPLOY_NAME (this may take several minutes)..."
az deployment group create --name "$DEPLOY_NAME" "${DEPLOY_ARGS[@]}" --output json \
  >"$ROOT/azure/.last-deployment.json"

STATIC_URL=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.staticWebAppUrl.value -o tsv)
CORS_VAL=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.corsOriginsConfigured.value -o tsv)
WEBAPP_NAME=""
API_URL=""

if [[ "$API_HOSTING" == "appservice" ]]; then
  API_URL=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.apiUrl.value -o tsv)
  WEBAPP_NAME=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.webAppNameOut.value -o tsv)
else
  echo "Building and publishing API image (Azure Container Registry; may take several minutes)..."
  az extension add --upgrade --name containerapp >/dev/null 2>&1 || true

  ACR_NAME=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.acrName.value -o tsv)
  ACR_LOGIN=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.acrLoginServer.value -o tsv)
  ENV_ID=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.containerAppEnvironmentId.value -o tsv)
  if [[ -z "$ENV_ID" && -n "${AZURE_EXISTING_CONTAINER_ENV_ID:-}" ]]; then
    ENV_ID="$AZURE_EXISTING_CONTAINER_ENV_ID"
  fi
  if [[ -z "$ENV_ID" ]]; then
    echo "ERROR: Missing Container Apps environment id. This should not happen after a successful Bicep deploy." >&2
    exit 1
  fi
  CA_NAME=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.containerAppNameOut.value -o tsv)
  MYSQL_FQDN=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs.mysqlServerFqdn.value -o tsv)

  DATABASE_URL="mysql://shopadmin:${MYSQL_PASS}@${MYSQL_FQDN}:3306/ai_testing_shop?sslaccept=strict"

  if [[ ! -f "$ROOT/backend/Dockerfile" ]]; then
    echo "ERROR: Missing $ROOT/backend/Dockerfile (clone the full repo)." >&2
    exit 1
  fi

  IMAGE="${AZURE_PREBUILT_API_IMAGE:-${ACR_LOGIN}/shop-api:latest}"

  if [[ -n "${AZURE_PREBUILT_API_IMAGE:-}" ]]; then
    echo "Using existing image (AZURE_PREBUILT_API_IMAGE): $IMAGE"
  else
    echo "Publishing API image to $ACR_LOGIN …"
    if (cd "$ROOT/backend" && az acr build --registry "$ACR_NAME" --resource-group "$RG" --image shop-api:latest .); then
      :
    else
      echo "" >&2
      echo "az acr build failed. Many subscriptions block ACR cloud builds (TasksOperationsNotAllowed)." >&2
      echo "Trying local Docker: build linux/amd64 and docker push (install Docker Desktop if needed)." >&2
      if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: Docker is not installed. Options: install Docker Desktop and re-run; or build elsewhere and:" >&2
        echo "  docker build --platform linux/amd64 -t ${ACR_LOGIN}/shop-api:latest $ROOT/backend" >&2
        echo "  az acr login -n $ACR_NAME && docker push ${ACR_LOGIN}/shop-api:latest" >&2
        echo "Then: AZURE_PREBUILT_API_IMAGE=${ACR_LOGIN}/shop-api:latest $0 $BASE_NAME" >&2
        exit 1
      fi
      az acr login -n "$ACR_NAME"
      docker build --platform linux/amd64 -t "${ACR_LOGIN}/shop-api:latest" "$ROOT/backend"
      docker push "${ACR_LOGIN}/shop-api:latest"
    fi
  fi

  ACR_USER=$(az acr credential show -n "$ACR_NAME" -g "$RG" --query username -o tsv)
  ACR_PW=$(az acr credential show -n "$ACR_NAME" -g "$RG" --query 'passwords[0].value' -o tsv)

  if az containerapp show -g "$RG" -n "$CA_NAME" &>/dev/null; then
    echo "Updating existing Container App (new image only)..."
    az containerapp update -g "$RG" -n "$CA_NAME" --image "$IMAGE"
  else
    az containerapp create -g "$RG" -n "$CA_NAME" \
      --environment "$ENV_ID" \
      --workload-profile-name Consumption \
      --image "$IMAGE" \
      --registry-server "$ACR_LOGIN" \
      --registry-username "$ACR_USER" \
      --registry-password "$ACR_PW" \
      --ingress external \
      --target-port 4000 \
      --min-replicas 0 \
      --max-replicas 3 \
      --cpu 0.25 \
      --memory 0.5Gi \
      --secrets "database-url=${DATABASE_URL}" "jwt-secret=${JWT_SECRET}" \
      --env-vars \
        "DATABASE_URL=secretref:database-url" \
        "ADMIN_JWT_SECRET=secretref:jwt-secret" \
        "NODE_ENV=production" \
        "PORT=4000" \
        "CORS_ORIGINS=${CORS_VAL}"
  fi

  API_HOST=$(az containerapp show -g "$RG" -n "$CA_NAME" --query properties.configuration.ingress.fqdn -o tsv)
  API_URL="https://${API_HOST}"
  WEBAPP_NAME="$CA_NAME"
fi

echo ""
echo "apiUrl: $API_URL"
echo "staticWebAppUrl: $STATIC_URL"
if [[ "$API_HOSTING" == "appservice" ]]; then
  echo "webAppName (set AZURE_WEBAPP_NAME): $WEBAPP_NAME"
else
  echo "containerAppName (for reference): $WEBAPP_NAME"
  echo "GitHub: backend workflow targets App Service; for Container Apps use this script or add an ACR update step."
fi

echo ""
echo "=== Save these secrets locally (not committed) ==="
echo "MySQL admin password (user shopadmin): $MYSQL_PASS"
echo "ADMIN_JWT_SECRET: $JWT_SECRET"
echo ""
echo "Next steps:"
echo "1. In GitHub: set repository variable VITE_API_BASE_URL = $API_URL"
if [[ "$API_HOSTING" == "appservice" ]]; then
  echo "2. In GitHub: set repository variable AZURE_WEBAPP_NAME = $WEBAPP_NAME"
  echo "3. Secret AZURE_WEBAPP_PUBLISH_PROFILE (App Service publish profile)"
fi
echo "4. Secret AZURE_STATIC_WEB_APPS_API_TOKEN (Static Web App deployment token)"
echo "5. Push to main for frontend workflow; deploy backend via script above or extend CI for ACR."
echo ""
echo "One-time DB seed from your laptop (allow your IP on MySQL firewall if needed):"
echo "  export DATABASE_URL='mysql://shopadmin:<PASSWORD>@<FQDN>:3306/ai_testing_shop?sslaccept=strict'"
echo "  cd backend && npx prisma migrate deploy && npm run prisma:seed"
