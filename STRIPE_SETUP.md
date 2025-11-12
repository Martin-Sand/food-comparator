# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payments for premium subscriptions.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- Access to Stripe Dashboard
- Your application deployed or accessible via a public URL (for webhooks)

## Step-by-Step Setup

### 1. Create a Stripe Account

1. Go to https://stripe.com and sign up
2. Complete your account setup
3. Switch to **Test Mode** (toggle in the top-right corner)

### 2. Create a Product and Price

1. In Stripe Dashboard, go to **Products** → https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Fill in product details:
   - **Name**: Premium Subscription
   - **Description**: Unlimited product comparisons and searches
   - **Pricing model**: Standard pricing
   - **Price**: $9.99 (or your desired price)
   - **Billing period**: Monthly
   - **Currency**: USD (or your preferred currency)
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`) - you'll need this for `.env`

### 3. Get Your API Keys

1. Go to **Developers** → **API keys** → https://dashboard.stripe.com/test/apikeys
2. Copy your keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - **Keep this secure!**

### 4. Set Up Webhook Endpoint

#### For Local Development (using Stripe CLI):

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:5050/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_...`)

#### For Production:

1. Go to **Developers** → **Webhooks** → https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Set the endpoint URL: `https://yourdomain.com/webhook`
4. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. **Copy the Signing secret** (starts with `whsec_...`)

### 5. Update Environment Variables

1. Copy `.env.example` to `.env` (if not already done)
2. Add your Stripe credentials to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret
STRIPE_PRICE_ID=price_your_actual_price_id
```

**Important**: Never commit your `.env` file to version control!

### 6. Test the Payment Flow

1. Start your Flask application:
   ```bash
   python app/app.py
   ```

2. If testing locally, start Stripe CLI webhook forwarding in another terminal:
   ```bash
   stripe listen --forward-to localhost:5050/webhook
   ```

3. Navigate to the pricing page: http://localhost:5050/pricing

4. Click **"Upgrade Now"** button

5. Use Stripe test cards:
   - **Successful payment**: `4242 4242 4242 4242`
   - **Declined card**: `4000 0000 0000 0002`
   - **3D Secure required**: `4000 0025 0000 3155`
   - Use any future expiry date (e.g., 12/34)
   - Use any 3-digit CVC (e.g., 123)
   - Use any valid ZIP code (e.g., 12345)

6. Complete the checkout process

7. Verify:
   - User is redirected to success page
   - User's subscription status is updated in database
   - User can access premium features
   - Webhook events appear in Stripe Dashboard → **Developers** → **Events**

### 7. Test Subscription Management

1. Log in with a premium account
2. Go to Profile page
3. Click **"Manage Subscription"**
4. You should be redirected to Stripe Customer Portal
5. Test:
   - Updating payment method
   - Canceling subscription
   - Viewing invoices

## Important Features

### What's Implemented:

1. **Checkout Flow**
   - Secure Stripe Checkout session
   - Automatic customer creation
   - Subscription creation

2. **Webhook Handling**
   - Payment success/failure
   - Subscription updates
   - Subscription cancellation
   - Automatic database updates

3. **Customer Portal**
   - Manage payment methods
   - Cancel/resume subscriptions
   - View billing history
   - Download invoices

4. **User Experience**
   - Pricing page with clear plan comparison
   - Upgrade buttons throughout app
   - Usage limits for free users
   - Premium features locked for free users

## Database Schema

The User model includes these Stripe-related fields:

- `stripe_customer_id`: Stripe customer ID
- `subscription_status`: 'free', 'active', or 'cancelled'
- `subscription_end_date`: Current period end date

## Security Best Practices

1. **Never expose secret keys**:
   - Keep `STRIPE_SECRET_KEY` in `.env`
   - Never commit `.env` to version control
   - Use environment variables in production

2. **Verify webhook signatures**:
   - Always validate webhook signatures
   - Use `STRIPE_WEBHOOK_SECRET`
   - Our implementation already does this

3. **Use HTTPS in production**:
   - Stripe requires HTTPS for webhooks
   - Use SSL certificates (Let's Encrypt is free)

## Going to Production

1. **Switch to Live Mode** in Stripe Dashboard

2. **Create production product and price**:
   - Go to Live mode Products
   - Create the same product as in test mode
   - Copy the new **Live** Price ID

3. **Get Live API keys**:
   - Go to Live mode API keys
   - Copy Live secret and publishable keys
   - These start with `sk_live_` and `pk_live_`

4. **Set up Live webhook**:
   - Go to Live mode Webhooks
   - Add endpoint with your production URL
   - Copy Live webhook signing secret

5. **Update production environment variables**:
   - Use Live keys instead of Test keys
   - Deploy with updated environment variables

6. **Test with real card** (small amount first!)

## Troubleshooting

### Webhook not receiving events:
- Check webhook URL is publicly accessible
- Verify webhook secret is correct
- Check Stripe Dashboard → Webhooks → Endpoint logs
- For local testing, ensure `stripe listen` is running

### Payment succeeds but user not upgraded:
- Check webhook is configured correctly
- Check application logs for errors
- Verify database connection
- Check Stripe Dashboard → Events for failed webhook deliveries

### Customer Portal not working:
- Ensure user has `stripe_customer_id`
- Check if customer exists in Stripe Dashboard
- Verify API keys are correct

### Testing webhooks locally:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # Mac
# OR download from: https://github.com/stripe/stripe-cli/releases

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:5050/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_succeeded
```

## Additional Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe Testing: https://stripe.com/docs/testing
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Stripe Billing: https://stripe.com/docs/billing
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Stripe CLI: https://stripe.com/docs/stripe-cli

## Support

For Stripe-specific issues:
- Stripe Support: https://support.stripe.com
- Stripe Community: https://github.com/stripe

For application issues:
- Check application logs
- Review database for subscription status
- Test webhook delivery in Stripe Dashboard
