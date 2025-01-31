#!/bin/bash

# Load .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ ERROR: .env file not found!"
  exit 1
fi

# Switch between environments
if [[ "$1" == "sandbox" ]]; then
  echo "Switching to SANDBOX mode..."
  export PLAID_ENV="sandbox"
  export PLAID_SECRET="$PLAID_SECRET_SANDBOX"
  export PLAID_CLIENT_ID="$PLAID_CLIENT_ID_SANDBOX"
elif [[ "$1" == "production" ]]; then
  echo "Switching to PRODUCTION mode..."
  export PLAID_ENV="production"
  export PLAID_SECRET="$PLAID_SECRET_PROD"
  export PLAID_CLIENT_ID="$PLAID_CLIENT_ID_PROD"
else
  echo "❌ Invalid option. Use 'sandbox' or 'production'."
  exit 1
fi

echo "✅ Switched to $PLAID_ENV mode."
echo "✅ PLAID_SECRET: $PLAID_SECRET"
echo "✅ PLAID_CLIENT_ID: $PLAID_CLIENT_ID"