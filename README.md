# Food Comparator - Production Deployment

## Quick Start

### Recommended: Railway Deployment

1. **Prerequisites**
   - GitHub account
   - Railway account (https://railway.app)
   - Stripe account with API keys
   - OpenAI API key

2. **One-Time Setup**
   ```bash
   # Run pre-deployment check
   python3 check_deployment.py
   ```

3. **Deploy to Railway**
   - Push code to GitHub
   - Go to Railway → New Project → Deploy from GitHub
   - Add PostgreSQL database
   - Set environment variables (see below)
   - Railway auto-deploys!

4. **Environment Variables**
   Set these in Railway dashboard:
   ```
   SECRET_KEY=<random-string>
   OPENAI_API_KEY=sk-...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   DEBUG=False
   ```

5. **Post-Deployment**
   ```bash
   # In Railway shell:
   flask db upgrade
   python3 add_admin_role.py
   ```

6. **Update Stripe Webhook**
   - Go to Stripe Dashboard → Webhooks
   - Update URL to: `https://your-app.railway.app/webhook`

## Features

- 🔍 Product search and comparison
- 📊 Nutrition data visualization
- 👤 User authentication and profiles
- 💳 Stripe subscription integration
- 🔗 Shareable comparison links (premium)
- 🛡️ Admin panel for management
- 📁 Hierarchical category system

## Tech Stack

- **Backend**: Flask 3.0, SQLAlchemy, PostgreSQL
- **Frontend**: Vanilla JavaScript, Chart.js
- **Payments**: Stripe API
- **AI**: OpenAI GPT-4 Vision (OCR)
- **Deployment**: Docker, Railway/Render

## Database Migrations

Your app includes Flask-Migrate for database management:

```bash
# Create migration
flask db migrate -m "description"

# Apply migration
flask db upgrade

# Rollback
flask db downgrade
```

## Monitoring

After deployment, monitor:
- User signups and subscriptions
- API usage (OpenAI costs)
- Database size
- Error rates

## Scaling

As your app grows:
- Increase Railway/Render plan
- Add Redis for caching
- Set up CDN for static files
- Enable database connection pooling

## Support

For issues, check:
1. Railway/Render logs
2. Database connectivity
3. Environment variables
4. Stripe webhook logs

## Cost Breakdown

**Monthly Estimates:**
- Railway: $5-10
- OpenAI API: $5-50 (usage-based)
- Stripe: Free (2.9% + 30¢ per transaction)
- **Total**: ~$10-60/month depending on usage

## Security

- ✅ Environment variables for secrets
- ✅ HTTPS enforced by platform
- ✅ Password hashing (Werkzeug)
- ✅ CSRF protection (Flask)
- ✅ Stripe webhook signature verification

## Backup Strategy

- Railway/Render auto-backup PostgreSQL
- Export critical data periodically:
  ```bash
  pg_dump $DATABASE_URL > backup.sql
  ```

## License

Proprietary - All rights reserved
