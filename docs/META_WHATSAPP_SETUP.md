# Meta WhatsApp Embedded Sign-up Configuration Guide

Follow these steps to configure your platform app on Meta's Developer Console to support live merchant onboarding via the Embedded Sign-up flow.

---

## Step 1: Create a Meta Developer App
1. Go to the [Meta for Developers Dashboard](https://developers.facebook.com/).
2. Click **My Apps** -> **Create App**.
3. Select **Other** as the app type and click **Next**.
4. Select **Business** as the app type (this is required to access WhatsApp Business APIs).
5. Give your app a name (e.g., `Innovapos Platform`) and link it to your Meta Business Portfolio.
6. Click **Create App**.

---

## Step 2: Add WhatsApp & Facebook Login Products
1. In your App Dashboard, scroll to **Add products to your app**.
2. Find **WhatsApp** and click **Set up**.
3. Find **Facebook Login** and click **Set up**.
   - Under **Facebook Login** -> **Settings**:
     - Enable **Client OAuth Login**.
     - Enable **Web OAuth Login**.
     - Add your production URL to **Valid OAuth Redirect URIs** (e.g., `https://your-admin-portal.com/`).
     - Enable **Login with JavaScript SDK**.
     - Add your admin portal URL to **Allowed Domains for the JavaScript SDK** (e.g., `https://your-admin-portal.com`).

---

## Step 3: Configure Required API Scopes & App Review
To let merchants authorize their accounts via the login dialog, you must request and configure the following permissions:
1. Go to **App Settings** -> **Roles** or **App Review** -> **Permissions and Features**.
2. Request advanced access for the following scopes:
   - `whatsapp_business_management`: To retrieve and manage WhatsApp assets.
   - `whatsapp_business_messaging`: To send notifications/messages to customers.
   - `catalog_management`: To publish and update product catalogs.

*Note: For testing in Development mode, you can immediately authorize any Facebook user who is added as an Admin, Developer, or Tester under your Meta App roles without waiting for App Review.*

---

## Step 4: Retrieve App Credentials
1. In your Meta App Dashboard, go to **App Settings** -> **Basic**.
2. Copy your **App ID** and **App Secret**.
3. Add these credentials to your backend server's `.env` file:
   ```env
   META_APP_ID=your_facebook_app_id
   META_APP_SECRET=your_facebook_app_secret
   ```
4. Restart your backend server.

---

## Step 5: Configure Meta Webhooks
1. In your App Dashboard, go to **WhatsApp** -> **Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://your-pos-server.com/api/webhooks/whatsapp`
   - **Verify Token**: `innovapos_verify_token` (matches the system config)
3. Click **Verify and Save**.
4. Click **Manage** under webhook fields, and subscribe to the `messages` event.
