# Inventory Management System

A modern, full-stack inventory management solution designed for warehouses and businesses to efficiently track, manage, and locate inventory stock. Built with Next.js for a responsive frontend experience and Express.js for a robust backend API.

## 🚀 Features

- **Real-time Inventory Tracking** - Monitor stock levels and locations in real-time
- **Advanced Search & Filtering** - Quickly locate items across multiple warehouses
- **Multi-warehouse Support** - Manage inventory across different locations
- **User Authentication & Authorization** - Secure role-based access control
- **RESTful API** - Comprehensive backend API for inventory operations
- **Responsive Design** - Access from desktop, tablet, or mobile devices
- **Database Management** - Powered by Prisma ORM with MySQL
- **Redis Caching** - Fast session management and data caching
- **File Storage** - AWS S3 integration for document and image storage
- **Stripe Integration** - Subscription and payment processing

## 🛠️ Tech Stack

### Frontend

- **Next.js 15** - React framework with server-side rendering
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern utility-first styling

### Backend

- **Express.js** - Fast, minimalist web framework
- **TypeScript** - Full type safety across the stack
- **Prisma ORM** - Type-safe database client
- **MySQL 8.0** - Relational database
- **Redis** - Session store and caching
- **Socket.io** - Real-time bidirectional communication

### DevOps & Infrastructure

- **Docker & Docker Compose** - Containerized development environment
- **Traefik** - Reverse proxy and load balancer
- **MinIO** - S3-compatible object storage
- **Nodemon** - Auto-reload for development

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher) - `npm install -g pnpm`
- **Docker** & **Docker Compose**
- **Git**

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/SpaceWaffles5827/inventory-app.git
cd inventory-app
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Create a `.dev.env` file in the root directory based on the example below:

```env
# Application Ports
APP_INTERNAL_PORT=3000
SERVER_INTERNAL_PORT=5001
TRAEFIK_HTTP_PORT=3069
TRAEFIK_DASHBOARD_PORT=8080

# Database Configuration
MYSQL_PORT=3308
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=inventory_app_dev
MYSQL_USER=inventory_user
MYSQL_PASSWORD=your_database_password
MYSQL_ROOT_HOST=%

# Database URLs
DATABASE_URL=mysql://inventory_user:your_database_password@localhost:3308/inventory_app_dev
DATABASE_URL_ROOT=mysql://root:your_root_password@localhost:3308/inventory_app_dev

# Redis Configuration
REDIS_PORT=6380

# Session & Security
SESSION_SECRET=your_session_secret_key_here
COOKIE_SECRET=your_cookie_secret_key_here

# AWS S3 / MinIO Configuration
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=http://localhost:9000
BUCKET_NAME=inventory-app

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5001

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password

# Disaster Recovery (optional)
DR_ENDPOINT=http://192.168.1.88:9000
DR_MINIO_ROOT_USER=minioadmin
DR_MINIO_ROOT_PASSWORD=minioadmin
BACKUP_BUCKET_NAME=inventory-app-backups
BACKUP_CRON=0 3 * * *
```

**Security Note:** Generate secure secrets for `SESSION_SECRET` and `COOKIE_SECRET`:

```bash
# Generate a secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start the Application

```bash
pnpm dev
```

This command will:

1. Start Docker containers (MySQL, Redis, MinIO, Traefik)
2. Wait for the database to be ready
3. Sync Prisma schema with the database
4. Start the Next.js frontend (port 3000)
5. Start the Express backend (port 5001)

## 🚀 Available Scripts

### Development

```bash
# Start the full development environment
pnpm dev

# Start only the Docker stack (databases, Redis, etc.)
pnpm stack:up

# Start only the frontend
pnpm dev:front

# Start only the backend
pnpm dev:back

# Sync Prisma schema with database
pnpm prisma:sync
```

### Production

```bash
# Build the Next.js application
pnpm build

# Start the production server
pnpm start
```

### Code Quality

```bash
# Run ESLint
pnpm lint
```

## 📂 Project Structure

```
inventory-app/
├── app/                    # Next.js app directory (pages, layouts)
├── server/                 # Express.js backend
│   ├── controllers/        # Route controllers
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   ├── middleware/         # Custom middleware
│   ├── app.ts              # Express app configuration
│   └── index.ts            # Server entry point
├── prisma/                 # Database schema and migrations
│   └── schema.prisma       # Prisma schema definition
├── public/                 # Static assets
├── components/             # React components
├── lib/                    # Shared utilities
├── docker-compose.dev.yml  # Development Docker configuration
├── docker-compose.yml      # Production Docker configuration
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
└── .dev.env                # Development environment variables
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Inventory

- `GET /api/inventory` - List all inventory items
- `POST /api/inventory` - Create new inventory item
- `GET /api/inventory/:id` - Get inventory item details
- `PUT /api/inventory/:id` - Update inventory item
- `DELETE /api/inventory/:id` - Delete inventory item

### Users & Roles

- `GET /api/users/roles` - Get user roles
- `PUT /api/users/roles/:id` - Update user role

### Companies/Warehouses

- `GET /api/companies` - List companies/warehouses
- `POST /api/companies` - Create new company/warehouse

### Support

- `POST /api/support` - Submit support ticket

### Health Check

- `GET /api/alive` - Server health check

## 🗄️ Database

The application uses **MySQL 8.0** with **Prisma ORM** for type-safe database access.

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Push schema changes to database
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio

# Create a migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy
```

## 🐳 Docker Services

The development environment includes the following Docker services:

- **Traefik** (ports 3069, 8080) - Reverse proxy and dashboard
- **MySQL** (port 3308) - Primary database
- **Redis** (port 6380) - Session storage and caching
- **MinIO** (ports 9000, 9001) - S3-compatible object storage

Access services:

- **Traefik Dashboard**: http://localhost:8080
- **MinIO Console**: http://localhost:9001
- **Application**: http://localhost:3000
- **API**: http://localhost:5001

## 🔐 Authentication & Security

- **Passport.js** - Authentication middleware
- **bcrypt** - Password hashing
- **express-session** - Session management
- **Redis Store** - Secure session storage
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing configuration
- **Rate Limiting** - API rate limiting (if configured)

## 📦 Deployment

### Docker Production Deployment

```bash
# Build and start production containers
docker compose up -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

### Environment Variables for Production

Ensure you set the following in your production `.env`:

```env
NODE_ENV=production
DEV_MODE=false
DATABASE_URL=mysql://user:password@mysql:3306/inventory_app
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

## 🧪 Testing

```bash
# Run tests (when configured)
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Port Already in Use

If you encounter port conflicts:

```bash
# Kill process on specific port (Windows)
npx cross-port-killer 3000

# Kill process on specific port (Linux/Mac)
lsof -ti:3000 | xargs kill -9
```

# Kill process on specific port (Windows)

npx cross-port-killer 3000

# Kill process on specific port (Linux/Mac)

lsof -ti:3000 | xargs kill -9

````

### Database Connection Issues

```bash
# Restart MySQL container
docker compose restart mysql

# Check MySQL logs
docker compose logs mysql

# Verify database is running
docker compose ps
````

### Redis Connection Issues

```bash
# Restart Redis container
docker compose restart redis

# Test Redis connection
docker compose exec redis redis-cli ping
```

### Prisma Schema Sync Issues

```bash
# Reset database (WARNING: destroys all data)
npx prisma migrate reset

# Force push schema
npx prisma db push --force-reset
```

## 📞 Support

For support, email support@yourcompany.com or open an issue in the GitHub repository.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Prisma team for the excellent ORM
- Express.js community
- All open-source contributors

---

**Made with ❤️ for better inventory management**
