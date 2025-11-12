# Next Steps: Launch Your App! 🚀

## ✅ What's Done

- ✅ Complete admin panel with category management
- ✅ Docker containerization
- ✅ Railway deployment configuration (recommended)
- ✅ Render deployment configuration (alternative)
- ✅ Comprehensive deployment documentation
- ✅ Pre-deployment validation script

## 📋 Quick Launch Checklist

### 1. Prepare Environment Variables

Create a `.env` file for local testing (or set directly in Railway):

```bash
# Generate a secret key
python3 -c "import secrets; print(f'SECRET_KEY={secrets.token_hex(32)}')"

# Add to .env file:
SECRET_KEY=<generated-key>
OPENAI_API_KEY=<your-openai-key>
STRIPE_SECRET_KEY=<test-key-sk_test_...>
STRIPE_PUBLISHABLE_KEY=<test-key-pk_test_...>
STRIPE_WEBHOOK_SECRET=<from-stripe-dashboard>
STRIPE_PRICE_ID=<from-stripe-dashboard>
DATABASE_URL=postgresql://... (Railway sets this)
DEBUG=False
```

### 2. Test Locally with Docker (Optional)

```bash
# Build Docker image
docker build -t food-comparator .

# Run locally (make sure .env file exists)
docker run -p 5050:5050 --env-file .env food-comparator

# Visit http://localhost:5050
```

### 3. Push to GitHub

```bash
# Add all deployment files
git add .

# Commit
git commit -m "Add production deployment infrastructure"

# Push to GitHub
git push origin main
```

### 4. Deploy to Railway (Recommended)

1. **Create Railway account**: https://railway.app/
   - Sign up with GitHub

2. **Create new project**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will detect the Dockerfile automatically

3. **Add PostgreSQL database**:
   - In your project, click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically connects it with `DATABASE_URL`

4. **Set environment variables**:
   - Go to project → Variables
   - Add each variable from `.env.production.template`:
     - `SECRET_KEY` (generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"`)
     - `OPENAI_API_KEY`
     - `STRIPE_SECRET_KEY` (use test keys first: `sk_test_...`)
     - `STRIPE_PUBLISHABLE_KEY` (use test keys first: `pk_test_...`)
     - `STRIPE_WEBHOOK_SECRET` (get from Stripe dashboard)
     - `STRIPE_PRICE_ID` (create in Stripe dashboard)
     - `DEBUG=False`
   - Railway sets `PORT` and `DATABASE_URL` automatically

5. **Deploy**:
   - Railway deploys automatically
   - Get your URL: `https://your-app.up.railway.app`

### 5. Initialize Database

Once deployed, open Railway shell:

```bash
# In Railway dashboard → your-app → Shell

# Run migrations
flask db upgrade

# Make yourself admin (replace with your email)
python3 add_admin_role.py
```

### 6. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app.up.railway.app/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret → Update `STRIPE_WEBHOOK_SECRET` in Railway

### 7. Test Everything

- ✅ User registration/login
- ✅ Product search
- ✅ OCR image upload
- ✅ Comparison view
- ✅ Stripe checkout (test mode)
- ✅ Admin panel access
- ✅ Category management

### 8. Go Live (When Ready)

1. **Switch to live Stripe keys**:
   - In Railway Variables, replace test keys with live keys:
     - `STRIPE_SECRET_KEY=sk_live_...`
     - `STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - Update webhook with live mode URL
   - Update `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID`

2. **Update Stripe webhook to live mode**:
   - Create new webhook in Stripe Dashboard (live mode)
   - Point to your Railway URL

3. **Monitor your app**:
   - Railway Dashboard → Logs
   - Check for errors
   - Monitor OpenAI API usage

## 💰 Expected Costs

- **Railway**: $5/month free credit covers small apps
- **Database**: Included with Railway
- **OpenAI API**: $0.01-0.50 per OCR request (varies by usage)
- **Stripe**: 2.9% + $0.30 per transaction (only when you get paid)

**Total base cost**: $5-10/month + variable usage

## 📚 Documentation

- Full deployment guide: `DEPLOYMENT.md`
- Pre-deployment check: `python3 check_deployment.py`
- Railway docs: https://docs.railway.app/
- Render alternative: See `DEPLOYMENT.md`

## 🔧 Troubleshooting

**App won't start?**
- Check Railway logs
- Verify all environment variables are set
- Run `python3 check_deployment.py` locally

**Database errors?**
- Ensure migrations ran: `flask db upgrade`
- Check `DATABASE_URL` in Railway variables

**Stripe not working?**
- Verify webhook secret matches Railway URL
- Check test vs live key configuration
- View webhook events in Stripe Dashboard

**Categories not showing?**
- Check `categories.csv` uploaded correctly
- Verify `is_active` column exists
- Review app logs for errors

## 🎉 You're Ready!

Your food comparison app is production-ready. Follow the steps above and you'll be live in ~30 minutes!

Good luck with your launch! 🚀
