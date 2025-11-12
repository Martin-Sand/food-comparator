# Deployment Guide

## Option 1: Railway (Recommended)

### Why Railway?
- Simplest setup
- PostgreSQL included
- $5/month free credit
- Auto-deploy from GitHub
- Built-in environment variables

### Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL` environment variable

4. **Set Environment Variables**
   - Go to your service → "Variables" tab
   - Add these variables:
     ```
     SECRET_KEY=your-secret-key-here
     OPENAI_API_KEY=sk-...
     STRIPE_SECRET_KEY=sk_test_...
     STRIPE_PUBLISHABLE_KEY=pk_test_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     STRIPE_PRICE_ID=price_...
     ```

5. **Deploy**
   - Railway automatically builds and deploys from Dockerfile
   - Your app will be live at a railway.app URL

6. **Run Database Migrations**
   - In Railway dashboard, open your service
   - Click "Settings" → "Service" → "Command"
   - Run: `flask db upgrade`

7. **Set Up Admin User**
   - Run the migration script in Railway's terminal:
     ```bash
     python3 add_admin_role.py
     ```

### Stripe Webhook Setup
After deployment, update your Stripe webhook URL:
- Stripe Dashboard → Developers → Webhooks
- Update endpoint URL to: `https://your-app.railway.app/webhook`

---

## Option 2: Render

### Steps:

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will detect your `render.yaml` file

3. **Configure Environment Variables**
   - Render will prompt you to set these:
     ```
     OPENAI_API_KEY=sk-...
     STRIPE_SECRET_KEY=sk_test_...
     STRIPE_PUBLISHABLE_KEY=pk_test_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     STRIPE_PRICE_ID=price_...
     ```

4. **Database Setup**
   - Render automatically creates PostgreSQL database from `render.yaml`
   - `DATABASE_URL` is automatically set

5. **Deploy**
   - Click "Create Web Service"
   - Render builds and deploys automatically

6. **Run Migrations**
   - In Render dashboard, go to Shell
   - Run: `flask db upgrade`
   - Run: `python3 add_admin_role.py`

---

## Option 3: Docker + Your Own VPS

### If you prefer full control:

1. **Build Docker Image**
   ```bash
   docker build -t food-comparator .
   ```

2. **Run with Docker Compose**
   Create `docker-compose.yml`:
   ```yaml
   version: '3.8'
   services:
     web:
       build: .
       ports:
         - "5050:5050"
       environment:
         - DATABASE_URL=postgresql://user:password@db:5432/food_comparator
         - SECRET_KEY=your-secret-key
         - OPENAI_API_KEY=sk-...
         - STRIPE_SECRET_KEY=sk_test_...
         - STRIPE_PUBLISHABLE_KEY=pk_test_...
         - STRIPE_WEBHOOK_SECRET=whsec_...
         - STRIPE_PRICE_ID=price_...
       depends_on:
         - db
     
     db:
       image: postgres:15
       environment:
         - POSTGRES_USER=user
         - POSTGRES_PASSWORD=password
         - POSTGRES_DB=food_comparator
       volumes:
         - postgres_data:/var/lib/postgresql/data
   
   volumes:
     postgres_data:
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

---

## Post-Deployment Checklist

- [ ] Database migrations run successfully
- [ ] Admin user created (masand97@gmail.com)
- [ ] Stripe webhook URL updated
- [ ] Environment variables all set
- [ ] Test login and registration
- [ ] Test product search
- [ ] Test comparison feature
- [ ] Test premium subscription flow
- [ ] Test shared links
- [ ] Verify admin panel access

---

## Production Optimizations

### 1. Update app.py for production
Change the last lines in `app/app.py`:
```python
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    debug = os.environ.get('DEBUG', 'False') == 'True'
    print(f"Starting server at http://127.0.0.1:{port} (debug={debug})")
    app.run(host='0.0.0.0', port=port, debug=debug)
```

### 2. Set DEBUG=False in production
Add to your environment variables:
```
DEBUG=False
```

### 3. Use Production Stripe Keys
Replace test keys with live keys:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 4. Set Up Domain
- Point your domain to Railway/Render
- Update Stripe webhook to use your domain
- Update any hardcoded URLs in templates

---

## Cost Estimates

### Railway:
- Free: $5/month credit (good for small apps)
- Hobby: $5/month per service after credit
- PostgreSQL: Included in service cost

### Render:
- Free tier: Web service sleeps after 15 min inactivity
- Starter: $7/month for always-on
- PostgreSQL: Free tier available (expires after 90 days)

### My Recommendation:
Start with **Railway** - it's the smoothest experience and $5/month is very affordable for a production app.
