# Glancalyzer - Eye Tracking Analysis Platform

A modern React TypeScript web application with a Convex backend for eye tracking analysis and visual attention pattern understanding.

## Features

- **User Authentication**: Email verification system with secure user management
- **Picture Upload**: Drag-and-drop image upload with file validation
- **Eye Tracking Experiments**: Webcam-based eye tracking analysis with WebGazer.js
- **Rate Limiting**: Unregistered users limited to 1 picture per 7 days
- **Membership Tiers**: Free, Basic, Premium, and Enterprise tiers with different limits
- **Auto Cleanup**: Automatic deletion of expired free-tier content after 7 days
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Convex (self-hosted with Docker)
- **Authentication**: Email verification system
- **File Storage**: Convex file storage
- **Database**: Convex database with real-time subscriptions

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd gazalyzer
npm install
```

### 2. Environment Setup

```bash
cp env.example .env
```

Edit `.env` with your configuration:
- `CONVEX_DEPLOY_KEY`: Your Convex deployment key
- `CONVEX_DEPLOYMENT`: Set to `dev` for development
- Email settings for verification (optional for development)

### 3. Set up Convex Backend

```bash
# Install Convex CLI globally
npm install -g convex

# Initialize Convex for development (this will create a deployment)
npx convex dev

# Follow the prompts to:
# 1. Create a Convex account if you don't have one
# 2. Create a new project for development
# 3. The CLI will automatically configure your environment
```

### 4. Environment Configuration

The `npx convex dev` command will automatically:
- Create a `.env.local` file with your deployment URL
- Set up the development environment
- Configure authentication

No manual environment configuration needed for development!

### 5. Start the Application

**Option A: Local Development (Recommended)**
```bash
# Terminal 1: Start Convex backend
npx convex dev

# Terminal 2: Start React frontend
npm run dev
```

**Option B: Docker Development**
```bash
# Start everything with Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at `http://localhost:3000`

## Project Structure

```
gazalyzer/
├── convex/                 # Convex backend functions
│   ├── schema.ts          # Database schema
│   ├── auth.ts            # Authentication functions
│   ├── pictures.ts        # Picture management
│   ├── experiments.ts     # AI experiments
│   └── crons.ts           # Scheduled tasks
├── src/                   # React frontend
│   ├── components/        # Reusable components
│   ├── pages/            # Page components
│   ├── hooks/            # Custom React hooks
│   └── main.tsx          # App entry point
├── docker-compose.yml     # Docker configuration
└── package.json          # Dependencies
```

## Database Schema

### Users
- Email verification system
- Membership tiers (free, basic, premium, enterprise)
- Experiment count tracking

### Pictures
- File storage integration
- Expiration tracking for free tier
- IP-based rate limiting

### Experiments
- AI analysis results
- Status tracking (pending, processing, completed, failed)
- Parameter storage

## Membership Tiers

| Tier | Monthly Experiments | Image Retention | Features |
|------|-------------------|-----------------|----------|
| Free | 5 | 7 days | Basic AI analysis |
| Basic | 50 | 30 days | Advanced AI analysis |
| Premium | 200 | Unlimited | All features + Priority processing |
| Enterprise | 1000 | Unlimited | API access + Priority support |

## Rate Limiting

- **Unregistered users**: 1 picture per 7 days (IP-based)
- **Registered users**: Based on membership tier
- **Automatic cleanup**: Free tier images deleted after 7 days

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Convex Development
```bash
# Start Convex dev server
npm run convex:dev

# Deploy to production
npm run convex:deploy
```

## Docker Configuration

The application includes Docker Compose configuration for self-hosting:

- **Convex Backend**: Self-hosted Convex instance
- **Nginx**: Optional reverse proxy for production
- **Environment**: Isolated development environment

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/verify` - Verify email token
- `GET /auth/user` - Get current user

### Pictures
- `POST /pictures/upload` - Upload new picture
- `GET /pictures` - List user pictures
- `DELETE /pictures/:id` - Delete picture

### Experiments
- `POST /experiments` - Create new experiment
- `GET /experiments` - List user experiments
- `GET /experiments/:id` - Get experiment details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the Convex documentation for backend questions
