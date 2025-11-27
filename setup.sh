# #!/bin/bash

# echo "🚀 Gazalyzer Setup - Convex in Docker, React Local"

# # Check if Docker is running
# if ! docker info > /dev/null 2>&1; then
#     echo "❌ Docker is not running. Please start Docker first."
#     exit 1
# fi

# # Check if docker compose is available
# if ! docker compose version &> /dev/null; then
#     echo "❌ Docker Compose is not available."
#     echo "   Install with: sudo apt install docker-compose-plugin"
#     exit 1
# fi

# echo "📦 Installing dependencies..."
# npm install

# echo "🐳 Starting Convex backend in Docker..."
# docker compose up -d

# echo "⏳ Waiting for Convex to start..."
# sleep 20

# echo "🔧 Checking for existing Convex admin key..."
# if [ -f ".convex-admin-key" ]; then
#     ADMIN_KEY=$(cat .convex-admin-key)
#     echo "Using existing admin key: $ADMIN_KEY"
# else
#     echo "Generating new Convex admin key..."
#     ADMIN_KEY=$(docker compose exec backend ./generate_admin_key.sh 2>/dev/null | grep -o 'Admin key: [^[:space:]]*' | cut -d' ' -f3)
#     echo "$ADMIN_KEY" > .convex-admin-key
#     echo "New admin key: $ADMIN_KEY"
#     echo "Key saved to .convex-admin-key for future use"
# fi

# echo "🔧 Deploying functions to Convex..."
# CONVEX_DEPLOY_KEY=$ADMIN_KEY npx convex dev --url http://localhost:3210 --once

# echo "🔄 Starting React frontend..."
# npm run dev &
# REACT_PID=$!

# echo "✅ Setup complete!"
# echo "🌐 Frontend: http://localhost:3000 (React running locally)"
# echo "🔧 Convex Backend: http://localhost:3210 (Docker)"
# echo "📊 Convex Dashboard: http://localhost:6791 (Docker)"
# echo ""
# echo "🔑 Admin Key: $ADMIN_KEY"
# echo "   Use this key to access the Convex dashboard"
# echo ""
# echo "Press Ctrl+C to stop React frontend"
# echo "To stop Convex: docker compose down"

# # Function to cleanup on exit
# cleanup() {
#     echo "🛑 Stopping React frontend..."
#     kill $REACT_PID 2>/dev/null
#     exit 0
# }

# # Set trap to cleanup on script exit
# trap cleanup SIGINT SIGTERM

# # Wait for React process
# wait $REACT_PID