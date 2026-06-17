/**
 * Merchant admin feature guide — used on the public marketing site.
 * Keep in sync with admin portal + POS capabilities.
 */

export const GUIDE_INTRO = {
  title: 'Cafinity merchant guide',
  subtitle:
    'Step-by-step instructions for merchant administrators: from signup and subscription to daily operations in the admin portal and POS.',
  portals: [
    { name: 'Admin portal', desc: 'Branding, billing, stores, menu setup, loyalty, promotions, analytics, and staff accounts.' },
    { name: 'POS app', desc: 'Register, kitchen, manager dashboard, inventory, tables, QR ordering, and day-to-day sales.' },
  ],
};

/**
 * @param {string} slug
 */
export function getGuideSectionBySlug(slug) {
  return GUIDE_SECTIONS.find((s) => s.slug === slug) ?? null;
}

export const GUIDE_SECTIONS = [
  {
    id: 'getting-started',
    slug: 'getting-started',
    title: '1. Getting started',
    summary: 'Apply, get approved, and sign in to the admin portal and POS.',
    overview:
      'Every Cafinity tenant begins with a business application on the public website. You provide contact details, business information, and your preferred subscription plan so the platform team can verify your account before any staff sign in.\n\n' +
      'After approval, you receive credentials by email and can open the admin portal to finish setup (subscription, branding, stores, and users). The POS app uses the same tenant with role-based access for cashiers, kitchen staff, and managers.\n\n' +
      'Expect a short trial period while you configure the basics. Complete subscription payment before the trial ends so registers and admin tools stay available without interruption.',
    prerequisites: [
      'A valid business email address you can access for approval and billing notices',
      'Business registration documents if required for your region (for example, a BR upload in Sri Lanka)',
      'A chosen subscription plan (monthly or yearly) from the signup flow',
      'Staff who will use the POS identified by role (cashier, kitchen, manager)',
    ],
    steps: [
      {
        heading: 'Apply for an account',
        body:
          'From the Cafinity website, open Sign up and complete the business application. Enter accurate contact details (for example: owner@beansandbrews.lk for your café, not a personal Gmail), upload any required registration documents (such as your business registration certificate), and select the plan that matches how you want to bill (monthly or yearly).\n\n' +
          'Example: Green Leaf Café in Colombo would enter "Green Leaf Café" as business name, upload their BR certificate, select the Monthly Standard plan at LKR 15,000/month, and use owner@greenleafcafe.lk as the admin email. After submitting, they receive a confirmation that their application is under review.\n\n' +
          'Submit the form when everything is correct. You will not have admin or POS access until a platform administrator approves the application, which typically takes 1-2 business days.',
        tip: 'Use the same email you want for the primary merchant admin account; approval messages and billing alerts go to this address. Avoid personal emails like Gmail or Yahoo—use your business domain (yourname@yourbusiness.com) for better professionalism and to avoid approval emails landing in spam filters.',
      },
      {
        heading: 'Wait for approval',
        body:
          'A platform administrator reviews your application and may contact you if anything is missing (for example, unclear business registration documents or incomplete contact information). When approved, you receive an email titled "Welcome to Cafinity - Your Account is Ready" with sign-in instructions and your temporary credentials.\n\n' +
          'Example: Green Leaf Café receives approval after 1 day. The email contains: username (owner@greenleafcafe.lk), temporary password (Change@123), and a link to the admin portal. They also get a 14-day trial period starting immediately, with one default store called "Green Leaf Café - Main Location" already created in their account.\n\n' +
          'Your tenant is provisioned with a trial period (typically 14 days) and a default store so you can start configuration immediately after your first login. The trial gives you full access to test branding, menu setup, and staff workflows before committing to payment.',
        tip: 'Save the approval email in a secure location—it contains your initial credentials. Change the temporary password immediately after your first login to maintain account security.',
      },
      {
        heading: 'Sign in to the admin portal',
        body:
          'Use Sign in → Admin portal on the website (typically https://admin.cafinity.io) with the email and password from your approval email. The dashboard shows trial days remaining (for example, "12 days left in trial") or active subscription status if you have already paid.\n\n' +
          'Example: The owner of Green Leaf Café visits https://admin.cafinity.io, enters owner@greenleafcafe.lk and their password, and lands on the Admin Dashboard. A banner at the top reads "Trial: 14 days remaining. Complete payment to activate full subscription." The left sidebar shows all admin tools: Dashboard, Subscription, Branding & Settings, Stores, Users, Add-ons, Analytics, Customers, and Notifications.\n\n' +
          'From here, complete subscription payment (to secure uninterrupted access after trial), set up branding (logo, colors, currency), configure your default store details, and invite staff users before opening the POS for live service.',
        tip: 'Bookmark the admin portal URL (https://admin.cafinity.io) in your browser for quick access to billing and configuration tasks. Only merchant admins and owners should have this link—cashiers and kitchen staff do not need admin portal access and should only use the POS application.',
      },
      {
        heading: 'Open the POS for staff',
        body:
          'Use Open POS from the admin sidebar, or navigate directly to Sign in → POS on the public website (typically https://pos.cafinity.io). Cashiers and kitchen staff sign in with individual accounts you create under Admin → Users—never share login credentials.\n\n' +
          'Example: Green Leaf Café creates three staff accounts: sarah@greenleafcafe.lk (Cashier role), ravi@greenleafcafe.lk (Kitchen role), and priya@greenleafcafe.lk (Manager role). Sarah logs into https://pos.cafinity.io with her credentials and sees only Register, Order Board, and Cashier Session tools. Ravi sees Kitchen Display. Priya (Manager) sees everything including Menu, Inventory, Promotions, Dashboard, and Reports.\n\n' +
          'Managers use the POS for operational tasks like menu updates, inventory tracking, promotion creation, and viewing the manager dashboard; merchant admins retain full control in the admin portal for billing, branding, user management, and subscription configuration.',
        tip: 'Test each role after creating accounts—have a cashier, kitchen staff, and manager log in on separate devices to verify they see only the tools appropriate for their role. This prevents access issues during your first live service shift.',
      },
    ],
    outcome: 'You have an approved tenant, can sign in to both portals, and are ready to pay for subscription and configure your business.',
  },
  {
    id: 'subscription',
    slug: 'subscription',
    title: '2. Subscription & billing',
    summary: 'Plans, regional payment options, plan changes, add-ons, and extra store billing.',
    overview:
      'Subscription keeps your admin portal and POS online. Admin → Subscription shows your current plan, billing period, payment history, and what you owe when renewing or adding capacity.\n\n' +
      'Billing options depend on where your business is registered. Sri Lanka merchants see plans priced in LKR and can pay by bank transfer (with receipt upload), Stripe card, or PayPal. International merchants see USD plans and PayPal only—bank transfer and Stripe are not offered for those accounts.\n\n' +
      'Optional add-ons (such as QR ordering and loyalty) bill separately. International add-on prices are set in USD by the platform administrator and may differ from LKR add-on pricing shown to Sri Lanka merchants.',
    prerequisites: [
      'Merchant admin access to the admin portal',
      'Knowledge of whether your account is billed as Sri Lanka (LKR) or international (USD)',
      'Payment method ready: bank receipt, card via Stripe, or PayPal as available on your Subscription page',
      'Understanding of your billing period end date if scheduling a plan change',
    ],
    steps: [
      {
        heading: 'View subscription status',
        body:
          'Open Admin → Dashboard for a quick view of trial days left (for example, "10 days remaining") or active subscription status (for example, "Paid until June 15, 2026"). Open Admin → Subscription for the full breakdown: plan name (such as Standard Monthly), billing period (monthly or yearly), active add-ons (QR Ordering, Loyalty), extra stores (with per-store charges), and complete payment history (all past transactions with dates and amounts).\n\n' +
          'Example: Urban Bistro (Sri Lanka) sees on their Subscription page:\n' +
          '- Plan: Standard Monthly - LKR 15,000\n' +
          '- Add-ons: QR Ordering (LKR 3,000), Loyalty (LKR 2,500)\n' +
          '- Extra Stores: 1 additional location (LKR 5,000)\n' +
          '- Total Due: LKR 25,500\n' +
          '- Next Renewal: June 1, 2026\n' +
          '- Payment History: May 1 - LKR 25,500 (Bank Transfer - Verified), April 1 - LKR 20,500 (PayPal - Completed)\n\n' +
          'Use this page before every payment so the amount you send or authorize matches the displayed total exactly. Mismatched payments delay verification and can cause service interruptions.',
        tip: 'Screenshot your Subscription page before making payments—keep this as proof of the amount owed if there are any disputes or verification delays. This is especially important for bank transfers where manual verification is required.',
      },
      {
        heading: 'Pay by bank transfer (Sri Lanka)',
        body:
          'If your account shows LKR pricing, you can pay by bank transfer. On Subscription, confirm the plan and period shown, transfer the exact amount to the listed bank account (Bank of Ceylon account #1234567890, Account Name: Cafinity Platform Pvt Ltd), then enter the transaction reference number (for example: TXN20260521AB1234) and upload a clear photo or PDF scan of the bank receipt.\n\n' +
          'Example: Green Leaf Café owes LKR 20,500 for their May subscription (Standard plan LKR 15,000 + QR add-on LKR 3,000 + Loyalty LKR 2,500). They transfer exactly LKR 20,500 from their business account to the Cafinity bank account, receive receipt with transaction ID TXN20260515XY9876, take a photo of the receipt, then go to Admin → Subscription → Pay by Bank Transfer. They enter TXN20260515XY9876 in the reference field, upload the receipt image, and click Submit. The page shows "Payment pending verification—you will be notified within 1-2 business days."\n\n' +
          'Submit the form and wait for verification. Until the payment is approved (typically 1-2 business days), treat the subscription as pending—do not assume access is extended until you receive email confirmation and the Subscription page shows "Paid" status.',
        tip: 'The payable total includes your base plan plus active add-ons and any extra stores—not just the plan price alone. Double-check the math before transferring: if you see Plan LKR 15,000, Add-ons LKR 5,500, Extra Stores LKR 5,000, you must transfer the sum (LKR 25,500), not just LKR 15,000. Always transfer from your registered business account, not a personal account, to speed up verification.',
      },
      {
        heading: 'Pay online (Stripe or PayPal)',
        body:
          'Sri Lanka merchants can use Stripe for card payments (Visa, Mastercard, Amex) or PayPal where shown on the Subscription page. International merchants (billed in USD) use PayPal exclusively for plan payments—bank transfer and Stripe are not offered for USD accounts.\n\n' +
          'Example (Sri Lanka - Stripe): Urban Bistro owes LKR 25,500. They click "Pay with Card (Stripe)" on the Subscription page, enter card details (4242 4242 4242 4242 for testing, or their real business card), and complete 3D Secure authentication if prompted. Payment processes immediately; the page refreshes to show "Paid until July 1, 2026" and they receive email confirmation within minutes.\n\n' +
          'Example (International - PayPal): Sunset Café in California owes $150 USD (Standard Monthly $120 + QR add-on $30). They click "Pay with PayPal," authenticate with their PayPal account, authorize the $150 charge, and return to Cafinity. The Subscription page updates to "Paid" status immediately after PayPal confirms the transaction.\n\n' +
          'Online payments are verified automatically within minutes; refresh the Subscription page or check your email notifications when the transaction completes. No manual verification is required for Stripe or PayPal payments.',
        tip: 'Use a business credit card or business PayPal account for easier expense tracking and accounting. Personal payment methods work but can complicate bookkeeping. Save your payment method in Stripe or PayPal for faster renewals—you will still need to authorize each charge, but details auto-fill.',
      },
      {
        heading: 'Schedule a plan change',
        body:
          'Use Change plan button on the Subscription page to switch between monthly and yearly billing, or to move to a different tier (for example, Basic to Standard, or Standard to Premium) at the end of the current billing period. After scheduling, the payment form shows the upcoming plan details so you are not double-charged for both the old and new plan in one period.\n\n' +
          'Example: Green Leaf Café is currently on Standard Monthly (LKR 15,000/month, renews June 1). On May 20, they decide to switch to Standard Yearly to save 15%. They click Change Plan, select Standard Yearly (LKR 153,000/year, equivalent to LKR 12,750/month), and choose "Apply at next renewal." The system schedules the change for June 1. On May 31, they pay LKR 153,000 (the yearly amount) instead of LKR 15,000, and their subscription updates to "Paid until May 31, 2027" (one full year from June 1, 2026).\n\n' +
          'You will see the scheduled change on the Subscription page with text like "Plan change scheduled: Standard Yearly effective June 1, 2026" until it takes effect. You can cancel the scheduled change before the renewal date if your plans change. After the change takes effect, your payment amount and renewal frequency update to match the new plan.',
        tip: 'Switching from monthly to yearly typically saves 10-20% over 12 months. Calculate your annual cost before committing: if monthly is LKR 15,000 (LKR 180,000/year), and yearly is LKR 153,000, you save LKR 27,000. Schedule the change a few days before renewal so you have time to prepare the larger payment amount.',
      },
      {
        heading: 'Subscribe to add-ons',
        body:
          'Open Admin → Add-ons to enable optional features such as QR ordering (for table service and scan-to-order) or loyalty programs (for points, tiers, and rewards). The first charge is prorated to the days left in your current billing period; after that, add-on renewals align with your main plan cycle (monthly or yearly).\n\n' +
          'Example (Sri Lanka): Urban Bistro has 20 days left in their May billing period (monthly plan renews June 1). On May 12, they enable QR Ordering (LKR 3,000/month). The system calculates prorated cost: (20 days / 31 days) × LKR 3,000 = LKR 1,935. They pay LKR 1,935 immediately via Stripe. Starting June 1, QR Ordering costs the full LKR 3,000/month and bills together with their main plan (LKR 15,000 plan + LKR 3,000 QR = LKR 18,000 total).\n\n' +
          'Example (International): Sunset Café (USD billing) enables Loyalty add-on mid-cycle. Their plan costs $120/month, Loyalty is $25/month. With 15 days remaining, proration is (15/30) × $25 = $12.50. They pay $12.50 immediately via PayPal. Next month, Loyalty bills the full $25 with their $120 plan ($145 total).\n\n' +
          'International merchants see USD add-on prices configured by the platform admin (for example, QR $30/month, Loyalty $25/month); Sri Lanka merchants see LKR add-on pricing (for example, QR LKR 3,000, Loyalty LKR 2,500). Confirm the currency and amount on the Add-ons page before enabling and paying—prices may differ between regions based on platform settings.',
        tip: 'Enable add-ons early in your billing cycle to minimize prorated charges. If your plan renews on the 1st of every month, enable add-ons on the 1st or 2nd so you pay nearly the full monthly price and avoid confusing partial-amount charges. Disable unused add-ons before renewal to stop recurring charges—you will not get refunds for partial months.',
      },
      {
        heading: 'Pay for additional stores',
        body:
          'Your first store is included in the base subscription at no extra cost. Each additional location is created on Admin → Stores and requires a prorated payment before the store is saved and becomes active for staff use.\n\n' +
          'Example: Green Leaf Café operates their main store in Colombo (included free). On May 15, they open a second location in Kandy and create it on Admin → Stores. Extra store cost is LKR 5,000/month. With 17 days left in May (renews June 1), proration is (17/31) × LKR 5,000 = LKR 2,742. They pay LKR 2,742 via bank transfer, upload the receipt, and wait for verification. After approval, the Kandy store becomes active and staff can select it in the POS store switcher. Starting June 1, the extra store bills the full LKR 5,000/month along with the plan and add-ons (Plan LKR 15,000 + Extra Store LKR 5,000 + Add-ons LKR 5,500 = LKR 25,500 total).\n\n' +
          'Expect the extra-store line item on your next Subscription breakdown after creation. Each additional store adds to your monthly or yearly total: if you create 3 extra stores (4 total including the free one), you pay for 3 × extra-store cost every billing cycle. Plan your multi-location rollout with this recurring cost in mind.',
        tip: 'Create additional stores at the start of your billing cycle (day 1 or 2) to avoid paying prorated charges and full charges in consecutive periods. If you create a store with 2 days left in the period, you pay a small proration now and the full amount in 2 days—consolidate by waiting until after renewal. Also, disable or archive stores you no longer operate to stop extra charges.',
      },
    ],
    outcome: 'Your subscription and add-ons are paid and verified, with a clear record of plan, period, and payment method for the current cycle.',
  },
  {
    id: 'branding',
    slug: 'branding',
    title: '3. Branding & business profile',
    summary: 'Logo, colors, currency, and receipt settings that apply across admin and POS.',
    overview:
      'Branding is how customers and staff recognize your business in Cafinity. Admin → Branding & Settings centralizes your legal business details, visual identity, and operational defaults.\n\n' +
      'The merchant sets the currency code and symbol here; that currency is used everywhere amounts appear in the admin portal and POS—including receipts, reports, and checkout totals. Set it once correctly before staff process live sales.\n\n' +
      'Logo and color choices flow to the POS interface (accent, headers, buttons) so the register matches your brand without per-device configuration.',
    prerequisites: [
      'Merchant admin access',
      'Final business name, address, phone, and email for receipts and customer-facing surfaces',
      'Logo file in a common image format',
      'Chosen currency for your market (for example LKR or USD)',
    ],
    steps: [
      {
        heading: 'Enter business details',
        body:
          'On Admin → Branding & Settings, set business name (for example, "Green Leaf Café"), full address ("123 Galle Road, Colombo 03, Sri Lanka"), phone number (required, for example "+94 11 234 5678"), and business email ("info@greenleafcafe.lk"). These fields print on every customer receipt and may appear on guest-facing ordering surfaces like QR menus.\n\n' +
          'Example: Urban Bistro enters:\n' +
          '- Business Name: Urban Bistro\n' +
          '- Address: 456 Duplication Road, Colombo 04, Sri Lanka\n' +
          '- Phone: +94 77 123 4567\n' +
          '- Email: hello@urbanbistro.lk\n' +
          '- Tax ID: 123456789V (optional, for tax receipt compliance)\n\n' +
          'After saving, they print a test receipt and verify all contact details appear correctly at the bottom. Customers can now call or email using the receipt information for inquiries or complaints.\n\n' +
          'Save after each change; incomplete contact details can block receipt compliance in some regions (for example, tax authorities may require business registration number and full address on receipts).',
        tip: 'Use your most reliable contact phone number—customers will call this number from receipts when they have questions, complaints, or want to place orders. Avoid personal mobile numbers; use a business line or customer service number that multiple staff can answer during business hours.',
      },
      {
        heading: 'Upload logo and choose colors',
        body:
          'Upload your logo (PNG, JPG, or SVG format, recommended size 512×512 pixels or larger for clarity) and pick a theme preset (such as Forest Green, Ocean Blue, Sunset Orange) or define custom brand colors. The POS uses your color palette in dark mode for headers, accent elements, and primary action buttons, ensuring brand consistency across all devices.\n\n' +
          'Example: Green Leaf Café uploads their logo (a green leaf icon, 1024×1024 PNG with transparent background). They choose custom colors:\n' +
          '- Primary: #2D5016 (deep forest green)\n' +
          '- Accent: #7CB342 (bright lime green)\n' +
          '- Background: #1E1E1E (dark charcoal for POS dark mode)\n\n' +
          'After saving, they open the POS on a tablet. The header bar is deep forest green (#2D5016), the "Add to Cart" and "Complete Payment" buttons are bright lime green (#7CB342), and the overall interface uses dark mode with their colors. The logo appears in the top-left corner of the POS and on printed receipts.\n\n' +
          'Preview how contrast looks on a typical register screen—test on an actual tablet or POS device in bright venue lighting (sunlight through windows, overhead cafe lights). Very light accent colors (pastels, light yellows) can be hard to read on white or light gray backgrounds; very dark accent colors can disappear on dark mode backgrounds. Aim for high contrast between text/buttons and their backgrounds.',
        tip: 'If you rebrand later (new logo, color scheme change), update colors and logo here first; staff devices automatically pick up the new theme on next page refresh or app reload without reinstalling or reconfiguring anything. Test your colors in real venue lighting conditions before finalizing—what looks great on your office monitor may be invisible on a sunlit counter iPad.',
      },
      {
        heading: 'Set currency',
        body:
          'Choose the currency code (ISO code such as LKR, USD, EUR, GBP) and symbol (such as Rs., $, €, £) your business uses day to day. This single setting drives how every monetary value is formatted and labeled across the entire platform: admin portal, POS screens, receipts, reports, analytics dashboards, and customer-facing QR menus.\n\n' +
          'Example: Green Leaf Café (Sri Lanka) sets currency code to LKR and symbol to "Rs." After saving, all prices display as "Rs. 850" (for example, a latte), "Rs. 15,000" (monthly subscription), and "Rs. 1,245.50" (daily sales total). Receipts print with "Rs." prefix. Analytics charts show revenue as "Rs. 125,000" for the week.\n\n' +
          'Example: Sunset Café (California, USA) sets currency code to USD and symbol to "$". Prices appear as "$8.50" (latte), "$120" (subscription), "$1,245.50" (daily sales). All reports and dashboards use "$" consistently.\n\n' +
          'Change currency only before go-live (during initial setup in trial period) or during a planned cutover (for example, if you change business registration from one country to another, which is rare). Historical analytics, completed orders, and financial reports assume the currency in effect when they were created—changing currency mid-operation does not retroactively convert past data and will cause confusion in reports (for example, mixing Rs. 10,000 orders with $100 orders in the same chart).',
        tip: 'Double-check currency before creating your first menu items and processing your first real sale. Changing currency after going live requires manual data cleanup or re-entry of historical records to maintain report accuracy. If you operate in a country that uses a currency symbol that looks like another (for example, $ for USD, CAD, AUD), include the ISO code in staff training so cashiers know which dollar they are charging.',
      },
      {
        heading: 'Configure receipt printing',
        body:
          'If your hardware supports it, define when receipts print (by order type or payment event). Match these rules to how your counter and kitchen actually hand off tickets.\n\n' +
          'Staff should run a test print after saving so paper width and branding look correct.',
      },
    ],
    outcome: 'Your brand, business identity, and currency are consistent across admin tools, POS screens, and printed receipts.',
  },
  {
    id: 'stores',
    slug: 'stores',
    title: '4. Stores & locations',
    summary: 'Create locations, pay for extra stores, and scope POS work to the right site.',
    overview:
      'Stores represent physical or logical locations under one merchant account. The first store is included in your subscription; each additional store requires payment before it becomes active.\n\n' +
      'Each store can have its own address, code, and accepted payment methods. Orders, sessions, and analytics respect the store selected in the POS so multi-site operators do not mix figures.\n\n' +
      'Plan store codes and names for reporting clarity—managers switching stores during a shift should always confirm the active store in the navigation bar.',
    prerequisites: [
      'Active or trial subscription with payment method understood for extra stores',
      'List of location names, addresses, and internal codes you want on reports',
      'Decision on which staff need access to which stores (see Users section)',
    ],
    steps: [
      {
        heading: 'Review your included store',
        body:
          'After approval, you typically have one default store created automatically during tenant provisioning (for example, "Green Leaf Café - Main Location" or "Urban Bistro Store 1"). Open Admin → Stores to confirm its name, store code (short alphanumeric identifier like GLC-01 or UB-MAIN), and address (123 Galle Road, Colombo 03).\n\n' +
          'Example: Green Leaf Café sees their default store:\n' +
          '- Store Name: Green Leaf Café - Colombo Main\n' +
          '- Store Code: GLC-COL\n' +
          '- Address: 123 Galle Road, Colombo 03, Sri Lanka\n' +
          '- Contact Phone: +94 11 234 5678\n' +
          '- Payment Methods Accepted: Cash, Card, Mobile Payment\n' +
          '- Status: Active\n\n' +
          'Edit details in the side drawer or modal if anything was a placeholder during provisioning (for example, generic "Store 1" name or incomplete address). Update the store name to match your actual location ("Colombo Main Branch" instead of "Default Store"), set a memorable store code for reports ("COL-MAIN" instead of "STORE1"), and confirm the address is complete for delivery coordination and customer inquiries.',
        tip: 'Use clear, location-specific store names like "Downtown Seattle" or "Colombo Fort Branch" rather than "Store 1" or "Location A"—this helps staff quickly identify which store they are working in when switching between locations in the POS.',
      },
      {
        heading: 'Add an extra location',
        body:
          'Click "Create Store" or "Add New Store" button and enter store name (for example, "Green Leaf Café - Kandy Branch"), store code (short identifier like GLC-KDY for reports and exports), full address (456 Peradeniya Road, Kandy, Sri Lanka), contact phone for that location, and payment methods accepted at that site (for example, Kandy branch accepts cash and cards but not mobile payments yet).\n\n' +
          'Example: Urban Bistro creates a second store for their new Galle location:\n' +
          '- Store Name: Urban Bistro - Galle Fort\n' +
          '- Store Code: UB-GALLE\n' +
          '- Address: 789 Church Street, Galle Fort, Galle, Sri Lanka\n' +
          '- Contact Phone: +94 91 222 3333\n' +
          '- Payment Methods: Cash, Card\n\n' +
          'After entering details, the system calculates prorated extra-store cost. With 20 days left in May (monthly plan, extra store costs LKR 5,000/month), proration is (20/31) × LKR 5,000 = LKR 3,226. The flow prompts: "Pay LKR 3,226 now to activate this store. Starting June 1, this store will cost LKR 5,000/month." Urban Bistro pays LKR 3,226 via PayPal, and the store status changes to Active. Staff can now select "Urban Bistro - Galle Fort" in the POS store switcher.\n\n' +
          'Complete payment the same way as subscription (bank transfer with receipt upload for Sri Lanka LKR accounts, or PayPal for international USD accounts). Until payment is verified, the store remains in Pending status and cannot be selected by staff in the POS.',
        tip: 'Use short, unique store codes (3-6 characters) that are easy to remember and type—they appear in CSV exports, analytics filters, and manager reports. Avoid generic codes like "S1" or "LOC2"; use location abbreviations like "COL" (Colombo), "KDY" (Kandy), "NYC" (New York), "SF" (San Francisco). This helps managers spot data from the wrong store quickly when reviewing reports.',
      },
      {
        heading: 'Maintain store details',
        body:
          'Open any store from the list and use the drawer to update address, contact, or payment flags after go-live.\n\n' +
          'Changes apply to new orders; do not rename codes casually if external systems reference them.',
      },
      {
        heading: 'Select the active store in POS',
        body:
          'Staff with access to multiple stores choose the active store from the POS navigation bar at the start of a shift.\n\n' +
          'Registers, kitchen tickets, sessions, and manager dashboard metrics all scope to that store until switched.',
      },
    ],
    outcome: 'Every location is defined in admin, paid for if beyond the first, and staff work in the correct store context in the POS.',
  },
  {
    id: 'users',
    slug: 'users',
    title: '5. Users & access control',
    summary: 'Invite staff, assign roles, and limit access by store.',
    overview:
      'Users connect people to your tenant with a role that controls which apps and menus they see. Merchant admins manage the full admin portal; managers run day-to-day POS configuration; cashiers and kitchen staff have focused workflows.\n\n' +
      'You can restrict a user to specific stores so they only see relevant orders and reports in the POS. This is essential when cashiers must not switch into another branch’s data.\n\n' +
      'Issue credentials securely and reset passwords when staff leave. Each active account should map to one real person for audit trails on sessions, voids, and approvals.',
    prerequisites: [
      'Merchant admin access',
      'List of staff names, emails, and intended roles',
      'Store assignments decided for multi-location staff',
      'Policy for manager approval PINs if your venue uses them for discounts or voids',
    ],
    steps: [
      {
        heading: 'Create staff accounts',
        body:
          'Go to Admin → Users and create an account for each person who needs POS or admin access. Enter their full name (for example, "Sarah Perera"), work email address (sarah.perera@greenleafcafe.lk is better than personal Gmail), and assign a temporary password they must change on first login. Use their work email where possible so password reset emails and notifications reach them directly at an address they check regularly.\n\n' +
          'Example: Green Leaf Café creates accounts for their team:\n' +
          '1. Sarah Perera - sarah.perera@greenleafcafe.lk - Cashier role - Access to Colombo Main store only\n' +
          '2. Ravi Fernando - ravi.fernando@greenleafcafe.lk - Kitchen role - Access to Colombo Main store only\n' +
          '3. Priya Silva - priya.silva@greenleafcafe.lk - Manager role - Access to all stores (Colombo and Kandy)\n' +
          '4. Anil Jayawardena - anil@greenleafcafe.lk - Merchant Admin role - Full access to admin portal and all stores\n\n' +
          'After creating each account, staff receive an email with login instructions and their temporary password. They sign in, change the password to something secure, and can immediately access the POS or admin portal based on their assigned role.\n\n' +
          'Avoid shared logins (for example, one "cashier@cafe.lk" account used by all cashiers)—separate accounts preserve audit trails showing exactly who opened each cashier session, who approved voids or discounts, and who made menu or inventory changes. If something goes wrong (missing cash, incorrect pricing), you can trace actions back to a specific person and timestamp.',
        tip: 'Use a consistent email naming pattern: firstname.lastname@yourbusiness.com or firstname@yourbusiness.com. This keeps the user list organized and makes it easy to find people when you have dozens of staff. If staff do not have company email addresses, create them using a free service like Google Workspace or Microsoft 365 for your domain—avoid personal Gmail addresses for business accounts.',
      },
      {
        heading: 'Assign roles',
        body:
          'Each user must have one role that determines what they can see and do in the POS and admin portal:\n\n' +
          '**Cashier role** — Access to POS register for taking orders, processing payments, and viewing the order board. Can open and close cashier sessions. Cannot access menu configuration, inventory, reports, or admin portal.\n' +
          'Example: Sarah (cashier) logs into the POS and sees: Register, Order Board, Cashier Session. She can take customer orders, process card and cash payments, and view open tickets. She cannot change menu prices, create promotions, or view sales reports.\n\n' +
          '**Kitchen role** — Access to kitchen display system (KDS) only. Can view incoming orders, mark items as preparing or ready, and update order status. Cannot take payments, access the register, or see financial data.\n' +
          'Example: Ravi (kitchen) logs into the POS and sees only: Kitchen Display. He sees new orders appear ("Table 5: 2x Latte, 1x Croissant"), marks items as "Preparing" when he starts, and "Ready" when complete. He cannot see prices, daily sales totals, or customer payment details.\n\n' +
          '**Manager role** — Access to all POS operational tools: register, order board, kitchen display, menu management, inventory tracking, promotions, manager dashboard, and operational reports (sales, top items, sessions). Cannot access admin portal features like billing, branding, subscription, or user management.\n' +
          'Example: Priya (manager) logs into the POS and sees everything: Register, Order Board, Kitchen, Menu, Inventory, Promotions, Dashboard, Reports. She can configure menu items and prices, track stock levels, create promotions, and view daily sales analytics. She cannot access Admin → Subscription, Branding, or create new user accounts (those require merchant admin access).\n\n' +
          '**Merchant Admin role** — Full access to admin portal (subscription, billing, branding, stores, users, add-ons) and all POS features. Reserved for business owners and senior leadership who handle billing and high-level configuration.\n' +
          'Example: Anil (merchant admin) can access everything: Admin Dashboard, Subscription payment, Branding settings, create/delete stores, create/delete users, enable add-ons, view full analytics, and everything managers and cashiers can do in the POS. This role should be limited to 1-3 trusted individuals.\n\n' +
          'Give the narrowest role that still lets the person do their job effectively. For example, if someone only needs to process payments at the counter, assign Cashier—do not assign Manager just because you want them to occasionally check inventory. Promote to manager only when they genuinely need menu configuration, inventory oversight, or daily reporting access. Over-assigning permissions increases security risk and billing exposure.',
        tip: 'Too many merchant admin accounts increases security risk and billing confusion—keep admin portal access restricted to business owners and one or two trusted supervisors who actually need to manage subscription, branding, and user accounts. For everyone else, Manager role is sufficient for day-to-day operations.',
      },
      {
        heading: 'Scope access by store',
        body:
          'When editing a user, restrict them to specific stores if they should not see other locations. Users with multiple stores still must pick the active store in the POS each shift.\n\n' +
          'Verify a test login from each role after saving restrictions.',
      },
      {
        heading: 'Set manager approval PIN (optional)',
        body:
          'Managers can set an approval PIN in their POS profile where your venue requires it for discounts, voids, or similar actions.\n\n' +
          'Communicate the PIN policy in person; do not distribute it like a shared cashier password.',
      },
    ],
    outcome: 'Every staff member has the right role and store scope, and managers can approve sensitive POS actions when configured.',
  },
  {
    id: 'menu',
    slug: 'menu',
    title: '6. Menu, categories & inventory',
    summary: 'Build categories, configure menu items with prices and images, create combo meals, manage availability, and track inventory with stock alerts.',
    overview:
      'The menu powers the register grid, kitchen routing, and guest QR menu. Managers maintain categories and items in the POS under Menu (not in the admin portal), keeping pricing close to the people who run service. Menu management is store-scoped—select the correct store in the POS navigation bar before building or editing.\n\n' +
      'Items support categories, prices, descriptions, multiple images, combo composition, and per-store availability flags. When you run out of an ingredient or discontinue a product temporarily, mark it unavailable so cashiers cannot sell what the kitchen cannot make—the item stays in your catalog for later reactivation.\n\n' +
      'Inventory tracking complements the menu with stock levels, minimum thresholds, and supplier records for purchasing discipline. Use inventory when low-stock awareness and supplier contact matter to your operation; skip it if you manage stock externally or run a service business with minimal physical goods.',
    prerequisites: [
      'Manager (or merchant admin) access to the POS',
      'Active store selected in the POS navigation bar',
      'Category structure planned (for example Beverages, Food, Desserts, Retail)',
      'Price list ready with currency matching branding configuration',
      'Product images prepared if you use photos on the register or QR menu',
      'Combo rules decided (which items bundle together and at what price)',
    ],
    steps: [
      {
        heading: 'Create and order categories',
        body:
          'Open POS → Menu (manager role only) and create categories that match how you want items grouped on the register grid, kitchen display, and guest QR menu. Name each category clearly and descriptively (for example, Hot Beverages, Cold Beverages, Breakfast Items, Sandwiches & Wraps, Salads, Desserts, Retail Products) so cashiers recognize them instantly during rush periods without hesitation.\n\n' +
          'Example: Green Leaf Café creates these categories:\n' +
          '1. Hot Drinks (Espresso, Latte, Cappuccino, Americano, Tea)\n' +
          '2. Cold Drinks (Iced Coffee, Smoothies, Fresh Juice)\n' +
          '3. Food (Sandwiches, Pastries, Breakfast Bowls)\n' +
          '4. Desserts (Cakes, Cookies, Brownies)\n' +
          '5. Retail (Coffee Beans, Mugs, T-shirts)\n\n' +
          'After creating categories, they drag "Hot Drinks" to position 1 (first on register grid), "Cold Drinks" to position 2, "Food" to position 3, etc. During service, cashiers see Hot Drinks category first (top-left of the grid) because 60% of orders are coffee-based—this reduces time spent scrolling or searching for popular items.\n\n' +
          'Reorder categories by dragging or using provided up/down arrow controls—place high-volume categories first (items that sell most frequently should be easiest to reach). For example, if 70% of your sales are beverages, put beverage categories at the top; if you are a restaurant where 80% of sales are entrees, put entree categories first. Categories appear in this exact order on: the POS register grid (cashiers see them in this sequence), kitchen display system (kitchen sees orders grouped by category in this order), and guest-facing QR menu (customers browse categories from top to bottom).\n\n' +
          'Avoid too many categories if your menu is small—three to five categories usually suffice for a café with 20-30 items. Too many categories (10+ for a small menu) forces excessive scrolling and makes the register grid harder to navigate during busy periods. Use more granular categories when you have dozens of products and need clear segmentation for reporting (for example, a full restaurant with 100+ items might use: Appetizers, Soups, Salads, Pasta, Pizza, Grilled Items, Seafood, Desserts, Beverages) or when kitchen routing requires it (different stations handle different categories). You can rename empty categories or delete them later without affecting existing items (deleting a category with items requires moving those items to another category first).',
        tip: 'Test your category order during a mock service shift before go-live. Have a cashier take 10-20 typical orders and note how many taps or scrolls are needed to reach common items. If popular items require excessive navigation, reorder categories or consolidate to reduce friction during real service.',
      },
      {
        heading: 'Add menu items with pricing and descriptions',
        body:
          'Click "Add Item" or "Create New Item" button in the menu interface, then enter item name (customer-facing name, for example "Caramel Latte" not "CAR-LAT-001"), price (in the currency configured in Admin → Branding & Settings, for example 450 for LKR 450 or 5.50 for $5.50), and select the category where this item belongs (for example, Hot Drinks). The item name should match exactly what cashiers and guests call the product—use natural language, not internal SKU codes or abbreviations.\n\n' +
          'Example: Green Leaf Café adds menu items:\n' +
          '1. Espresso - Hot Drinks category - Rs. 250 - Description: "Rich, bold shot of Italian espresso" - Active: Yes\n' +
          '2. Caramel Latte - Hot Drinks category - Rs. 450 - Description: "Espresso with steamed milk and caramel syrup" - Active: Yes\n' +
          '3. Turkey Club Sandwich - Food category - Rs. 850 - Description: "Triple-decker with turkey, bacon, lettuce, tomato, mayo on toasted white bread" - Active: Yes\n' +
          '4. Chocolate Brownie - Desserts category - Rs. 350 - Description: "Warm fudgy brownie with vanilla ice cream (contains nuts)" - Active: Yes\n\n' +
          'Price uses the currency configured in Admin → Branding & Settings—if branding shows LKR as currency, enter prices in rupees without currency symbols (just the number: 450, not Rs. 450). The system automatically adds the currency symbol when displaying prices to users. If branding shows USD, enter dollar amounts as decimals (5.50, not 5.5 or 5.50$). Mismatched expectations (entering USD prices when branding is set to LKR, or vice versa) usually mean branding currency was not configured correctly before menu setup—fix currency in Admin → Branding & Settings first, then rebuild or update all menu prices to match.\n\n' +
          'Add a description if helpful for QR menu guests or new staff training. Descriptions appear on the guest QR ordering interface and can include: ingredients ("made with almond milk and organic honey"), allergen warnings ("contains gluten, dairy, nuts"), preparation details ("grilled to order, served with fries and coleslaw"), or portion size ("serves 2-3 people"). Descriptions are optional—many fast-service venues skip them when item names are self-explanatory ("Espresso," "Americano," "Croissant" do not need descriptions). Use descriptions for complex dishes, combo meals, or when allergen disclosure is legally required in your region.\n\n' +
          'Set the item active and available by default so it immediately appears on the register and QR menu. The "active" toggle controls whether the item exists in your catalog; the "available" toggle controls whether it can be sold right now (mark unavailable when out of stock, but keep active to preserve historical order data). Save the item to make it sellable on the register, kitchen display, and QR menu. Repeat this process for every product you want on the menu, grouping similar items in the same category as you go (add all hot drinks together, then all cold drinks, then all food items, etc.) for organizational clarity.',
        tip: 'Enter prices in the currency configured in branding; mismatched expectations (entering dollars when branding is LKR, or entering rupees when branding is USD) usually mean branding currency was not set correctly before menu build. Always configure Admin → Branding & Settings → Currency FIRST, then build your menu—changing currency after creating 50 menu items means manually updating every price. Double-check the currency symbol on the Branding page before adding your first menu item to avoid costly rework.',
      },
      {
        heading: 'Upload product images',
        body:
          'Edit any item and upload one or more images. The first image becomes the primary photo shown on the register grid and QR menu; additional images provide alternate views or preparation shots. Use the reorder controls to change which image is primary after uploading multiple.\n\n' +
          'Images can be uploaded from your device or referenced by URL if you host them elsewhere. The system optimizes uploaded images for web and mobile display (resized and compressed to balance quality and load speed). Test how images look on a cashier tablet and a guest phone before finalizing—very dark or low-contrast photos can be hard to recognize quickly.\n\n' +
          'Images are optional but strongly recommended for QR ordering where guests browse without staff guidance. Register-only venues can skip images if cashiers know products by name and category.',
        tip: 'Use well-lit, simple product photos with minimal background clutter—guests should recognize the item in under a second when scrolling the QR menu.',
      },
      {
        heading: 'Build combo meals',
        body:
          'Create a new menu item and mark it as a combo (checkbox, toggle, or radio button depending on UI version). Name the combo meal clearly and appealingly (for example, "Breakfast Combo," "Family Meal Deal," "Lunch Special," or "Coffee & Pastry Bundle") and set the combo price—this is the single price the customer pays for the entire bundle, which should be lower than buying components separately to provide clear value.\n\n' +
          'Example: Green Leaf Café creates a "Morning Boost Combo":\n' +
          '- Combo Name: Morning Boost Combo\n' +
          '- Category: Meal Deals\n' +
          '- Components: 1x Latte (Rs. 450), 1x Croissant (Rs. 250), 1x Orange Juice (Rs. 300)\n' +
          '- Individual Total: Rs. 1,000\n' +
          '- Combo Price: Rs. 850 (15% savings)\n' +
          '- Description: "Perfect breakfast combo—coffee, pastry, and fresh juice to start your day"\n\n' +
          'Add component items by selecting existing menu items from a picker or dropdown and setting quantities for each. For the Breakfast Combo example above, you would:\n' +
          '1. Select "Latte" from Hot Drinks, set quantity to 1\n' +
          '2. Select "Croissant" from Food, set quantity to 1\n' +
          '3. Select "Orange Juice" from Cold Drinks, set quantity to 1\n\n' +
          'The system automatically calculates and displays the sum of individual item prices (Rs. 1,000 in this example) so you can verify the combo saves customers money versus ordering items separately (combo at Rs. 850 vs. individual total Rs. 1,000 = Rs. 150 savings, which is 15% discount). This validation helps you price combos competitively and avoid accidentally setting combo prices higher than individual items (which defeats the purpose).\n\n' +
          'Example: Urban Bistro creates a "Family Meal":\n' +
          '- Combo Name: Family Meal\n' +
          '- Components: 2x Large Pizza (Rs. 2,200 each), 4x Soft Drink (Rs. 150 each), 1x Garlic Bread (Rs. 400)\n' +
          '- Individual Total: Rs. 5,400\n' +
          '- Combo Price: Rs. 4,500 (17% savings)\n\n' +
          'Combo quantities multiply with the ordered amount at checkout: if a customer orders 1 Breakfast Combo, the kitchen sees 1 Latte, 1 Croissant, 1 Orange Juice. If they order 2 Breakfast Combos, the kitchen display shows 2 Lattes, 2 Croissants, 2 Orange Juices—the system automatically multiplies each component quantity by the number of combos ordered. This ensures kitchen prep is accurate and inventory tracking (if enabled) reflects actual consumption.\n\n' +
          'Use combos strategically when you want to: (1) Move multiple products together (for example, pair slow-moving desserts with popular entrees), (2) Offer discounts that drive higher transaction value (customers spend Rs. 850 on a combo instead of Rs. 450 on just coffee), (3) Simplify ordering for common pairings (lunch sets, sharing platters, drink + snack bundles that guests frequently order together anyway). Combos reduce decision fatigue for customers and speed up cashier workflow (one button instead of three separate items).\n\n' +
          'Combos cannot contain other combos as components—only standalone menu items. You cannot nest a "Breakfast Combo" inside a "Super Breakfast Combo." Choose a logical category for the combo item itself (for example, "Meal Deals," "Combos," "Specials") so it appears in a dedicated section on the register grid and QR menu, separate from individual items. This helps guests recognize value offerings quickly when browsing.',
        tip: 'Price combos at least 10–15% below the sum of individual items so customers perceive clear, meaningful value (Rs. 850 combo vs. Rs. 1,000 individual = 15% off is attractive; Rs. 980 vs. Rs. 1,000 = 2% off feels negligible and will not drive combo adoption). Promote combos visibly on your QR menu, at the counter, and in marketing—guests often do not discover combos unless you highlight them. Test combo performance in analytics: if a combo is not selling, the discount may be too small, the components may not pair well, or the name/description is not compelling. Adjust pricing, swap components, or improve the description based on what your analytics show.',
      },
      {
        heading: 'Set per-store availability',
        body:
          'When you operate multiple stores, decide if an item is available at all locations or only specific sites. Edit the item and toggle availability per store (UI may show store checkboxes or a similar mechanism). Items available at no stores are effectively hidden everywhere; items available at some stores appear only on those stores\' registers and QR menus.\n\n' +
          'Use per-store availability when product mix differs by location (for example, one branch sells alcohol and another does not, or a downtown store offers breakfast items a suburban location skips). Guests scanning QR codes at a specific table see only items available at that table\'s store.\n\n' +
          'For single-store operators, this setting is always checked for the one store and does not require attention.',
      },
      {
        heading: 'Manage availability and temporary outages',
        body:
          'Toggle any item available or unavailable without deleting it. Unavailable items disappear from the sellable register grid and QR menu but stay in your catalog for historical orders and future reactivation. Use unavailable to handle 86 situations (out of stock mid-service), seasonal items (pumpkin spice only in autumn), or test products you are phasing out.\n\n' +
          'Review availability at the start of every shift—mark items unavailable if you are low on ingredients or the kitchen cannot prepare them today. After restocking or resolving prep issues, toggle items available again so cashiers can sell them. Unavailable items show on the menu management screen with a visual indicator (grayed out or labeled) so managers know what is currently off the board.\n\n' +
          'Do not delete items that have historical orders—archiving or marking unavailable preserves past sales data and lets you reactivate the product later without recreating it.',
        tip: 'Train staff to check the menu availability screen before opening and after major prep or delivery events—nothing frustrates guests more than ordering an item that arrives as "sorry, we are out."',
      },
      {
        heading: 'Track inventory with stock levels and suppliers',
        body:
          'Open POS → Inventory (manager role) to record items you want to track for stock awareness and reordering discipline. Inventory tracking is optional—use it when low-stock alerts and supplier contact information matter to your operation (for example, restaurants, cafes with perishable goods, retail stores); skip it if you manage stock externally via spreadsheets or ERP systems, or if you run a service business with minimal physical goods.\n\n' +
          'Create an inventory record with:\n' +
          '- Item name (for example, Whole Milk 1L, Coffee Beans Dark Roast, Chicken Breast 1kg)\n' +
          '- Unit of measure (pieces, liters, kilograms, grams, boxes, cases, or custom units like "bags" or "cartons")\n' +
          '- Current quantity (how many units you have right now, for example 50 liters, 120 pieces)\n' +
          '- Minimum threshold (alert level that triggers low-stock warning, for example 20 liters, 30 pieces)\n\n' +
          'Example: Green Leaf Café tracks key ingredients:\n' +
          '1. Whole Milk - Unit: Liters - Current: 45L - Min Threshold: 15L - Status: OK (45 > 15)\n' +
          '2. Coffee Beans (Dark Roast) - Unit: Kilograms - Current: 8kg - Min Threshold: 10kg - Status: Low (8 < 10)\n' +
          '3. Croissants (Frozen) - Unit: Pieces - Current: 120 - Min Threshold: 50 - Status: OK\n' +
          '4. Orange Juice (Fresh) - Unit: Liters - Current: 10L - Min Threshold: 12L - Status: Low\n' +
          '5. Sugar (White) - Unit: Kilograms - Current: 25kg - Min Threshold: 10kg - Status: OK\n\n' +
          'The minimum threshold should be set based on:\n' +
          '- Lead time: How long it takes to reorder and receive stock (if supplier delivers weekly, threshold should cover 7+ days of usage plus safety buffer)\n' +
          '- Daily usage rate: How much you consume per day on average (if you use 5L milk per day and restock weekly, set threshold to 40L so you reorder before running out: 7 days × 5L + 5L buffer = 40L)\n' +
          '- Criticality: Items that stop service if depleted (milk for a café, proteins for a restaurant) need higher thresholds; non-critical items (decorative garnishes, optional add-ons) can have lower thresholds\n\n' +
          'Example threshold calculation: Green Leaf Café uses 5 liters of milk per day. Their supplier delivers every Monday (7-day cycle). They set milk threshold to 40L: (7 days × 5L/day) + 5L safety buffer = 40L. When stock drops to 40L (typically on Thursday or Friday), they see a "Low Stock" alert and place an order for Monday delivery, ensuring they never run out over the weekend.\n\n' +
          'The system shows stock status as:\n' +
          '- **OK**: Current quantity is above minimum threshold (you have enough stock)\n' +
          '- **Low**: Current quantity is below minimum threshold but still positive (reorder soon)\n' +
          '- **Critical**: Current quantity is very low, approaching zero (reorder immediately)\n' +
          '- **Out of Stock**: Current quantity is zero or negative (service may be impacted)\n\n' +
          'Assign suppliers to each inventory item for quick contact when reordering. Create supplier records under POS → Suppliers or Admin → Suppliers (depending on navigation) with:\n' +
          '- Supplier name (for example, "ABC Dairy Pvt Ltd," "City Coffee Roasters")\n' +
          '- Contact person (for example, "Nimal Perera")\n' +
          '- Phone (for example, "+94 11 234 5678")\n' +
          '- Email (for example, "orders@abcdairy.lk")\n' +
          '- Notes (delivery days, minimum order quantities, payment terms)\n\n' +
          'Then link suppliers to inventory items so when an item hits low stock, you see exactly who to call or email to reorder. One inventory item can have multiple suppliers if you source from different vendors for redundancy (for example, primary milk supplier is ABC Dairy, backup supplier is XYZ Farms in case ABC is out of stock).\n\n' +
          'Example supplier setup for Green Leaf Café:\n' +
          '- Whole Milk → Linked to: ABC Dairy (primary), XYZ Farms (backup)\n' +
          '- Coffee Beans → Linked to: City Coffee Roasters\n' +
          '- Croissants → Linked to: French Bakery Supplies\n\n' +
          'Important: Inventory tracking does NOT automatically decrement stock when orders are placed or items are sold—it is a manual awareness tool, not a real-time perpetual inventory system. You must manually update quantities when:\n' +
          '- Deliveries arrive: Add received quantity (delivery of 50L milk increases stock from 20L to 70L)\n' +
          '- Physical counts during audits: Correct quantity to actual counted amount (count shows 42L but system says 50L, update to 42L)\n' +
          '- Waste or spoilage discovered: Reduce quantity (5L milk spoiled, reduce stock from 50L to 45L)\n\n' +
          'If you need automatic stock deduction based on sales, consider integrating an external inventory management system or ERP—Cafinity inventory is designed for simple threshold-based reordering, not complex perpetual tracking.',
        tip: 'Use inventory tracking for high-value or critical items where running out stops service—milk, coffee beans, proteins (chicken, beef, fish), alcohol (if licensed). Skip inventory for low-cost, easy-to-replace items like napkins, stir sticks, paper cups, condiment packets, unless tracking those items matters to your cost control or supply chain discipline. Too many inventory records create maintenance burden—focus on the 20% of items that cause 80% of your stock-out problems.',
      },
      {
        heading: 'Update stock quantities and review alerts',
        body:
          'Edit inventory items to adjust current quantity when stock changes. Some UI versions support inline editing—click the quantity, type the new value, and save. Use this after receiving deliveries (add quantity), after audits (correct to actual count), or when you discover shrinkage or spoilage (reduce quantity).\n\n' +
          'The inventory list shows stock status for every item. Filter by Low or Critical to see what needs attention, then contact the linked suppliers or place orders through your usual process. Items marked Out of Stock should be made unavailable on the menu (if they are sold as standalone menu items) or flagged for combo meals that depend on them.\n\n' +
          'Run periodic inventory counts (weekly or monthly depending on volume) where you physically verify stock and update system quantities. Discrepancies between expected and actual stock highlight waste, theft, or data entry errors—investigate large variances and adjust processes before the next count.',
      },
      {
        heading: 'Archive or delete old items and categories',
        body:
          'When you permanently discontinue a product, mark it unavailable rather than deleting it if it has any historical orders—deletion can break receipt lookups and analytics. If you must delete an item with no order history, remove it from the menu list (usually a delete or archive button on the item row).\n\n' +
          'Delete or merge categories when your menu structure changes—move items to a new category before deleting the old one so nothing becomes orphaned. Empty categories can be deleted without affecting menu integrity.\n\n' +
          'For seasonal or test items, use unavailable to hide them off-season and reactivate next year without rebuilding descriptions, images, and pricing from scratch.',
      },
    ],
    outcome: 'Your menu is categorized, priced, illustrated with images, and scoped correctly per store. Combo meals bundle products at attractive prices, availability toggles reflect real kitchen capacity, and inventory tracking alerts you to low stock before outages disrupt service.',
  },
  {
    id: 'pos-operations',
    slug: 'pos-operations',
    title: '7. POS daily operations',
    summary: 'Register, order board, kitchen, cashier sessions, and day-end reporting.',
    overview:
      'Daily operations revolve around taking orders, moving them through the kitchen, collecting payment, and closing the day with accurate cash totals. Each role sees a tailored navigation menu in the POS.\n\n' +
      'Cashiers build carts and take payment; the order board shows open tickets; kitchen staff update preparation status. Managers oversee sessions, discounts, and end-of-day totals.\n\n' +
      'Consistent use of order types (dine-in, takeaway, delivery) and cashier sessions keeps analytics trustworthy for the admin and manager dashboards.',
    prerequisites: [
      'Staff accounts with cashier, kitchen, and/or manager roles',
      'Menu configured and priced',
      'Correct store selected in the POS',
      'Cash drawer and receipt printer tested if used',
    ],
    steps: [
      {
        heading: 'Open a cashier session',
        body:
          'Cashiers must open a session when starting a shift to attach all orders and cash movements to their personal accountability record for end-of-shift reconciliation. Navigate to POS → Cashier Session (or Sessions, depending on UI) and click "Open Session." Enter opening float amount if your process requires it (the cash amount in the drawer at shift start, for example Rs. 5,000 or $100).\n\n' +
          'Example: Sarah (cashier) arrives for her 9 AM shift. She counts the cash drawer and finds Rs. 5,000. She logs into the POS, goes to Cashier Session, clicks "Open Session," enters "Opening Float: 5,000" and clicks Confirm. The system creates Session #2847 tied to Sarah\'s user account, timestamped 9:00 AM. All orders Sarah processes from 9 AM until she closes the session are linked to Session #2847 for tracking.\n\n' +
          'During the session, every order Sarah completes, every cash payment received, every card transaction, and every refund is automatically recorded under her session. At shift end, she will compare actual cash in drawer against expected cash (opening float + cash sales - cash refunds) to identify overages or shortages.\n\n' +
          'Do not share an open session between people—each cashier should use their own login and open their own session. Sharing sessions destroys accountability: if Session #2847 has a Rs. 2,000 shortage and three people used the same session, you cannot determine who made the error. Separate sessions ensure audit trails show exactly which cashier handled which transactions.',
        tip: 'Take a photo of the cash count before opening the session or have a manager verify your opening float amount. This prevents disputes if there are discrepancies later (for example, if you claim Rs. 5,000 opening float but someone else says the drawer only had Rs. 4,000). Documentation protects both staff and management.',
      },
      {
        heading: 'Take orders on the register',
        body:
          'Navigate to Register → New Order (or similar) to start building a customer order. Add items by tapping category buttons (for example, Hot Drinks) then item buttons (for example, Latte, Cappuccino), adjust quantities using + / - controls if customer orders multiples, and choose order type (Dine-in, Takeaway, Delivery) to properly classify the sale for analytics and kitchen routing. If applicable, assign a table number for dine-in orders so kitchen and service staff know where to deliver food.\n\n' +
          'Example workflow - Counter order at Green Leaf Café:\n' +
          '1. Customer: "I\'ll have 2 lattes and a turkey sandwich to stay"\n' +
          '2. Cashier Sarah: Taps "Hot Drinks" category → "Latte" → Qty 2 (Rs. 450 each = Rs. 900)\n' +
          '3. Taps "Food" category → "Turkey Club Sandwich" (Rs. 850)\n' +
          '4. Cart shows: 2x Latte (Rs. 900), 1x Turkey Club (Rs. 850), Total Rs. 1,750\n' +
          '5. Selects "Dine-in" order type, assigns "Table 7"\n' +
          '6. Taps "Send to Kitchen" — kitchen display shows order for Table 7, cashier proceeds to payment\n\n' +
          'Example workflow - Takeaway order:\n' +
          '1. Customer: "3 espressos to go, and do you have any promotions?"\n' +
          '2. Cashier: Taps "Hot Drinks" → "Espresso" → Qty 3 (Rs. 250 each = Rs. 750)\n' +
          '3. Selects "Takeaway" order type (no table needed)\n' +
          '4. At payment screen, checks active promotions and applies "Morning Rush Special - 10% off" if eligible (total drops to Rs. 675)\n' +
          '5. Customer pays Rs. 675 cash, receives receipt and order number for pickup\n\n' +
          'Apply promotions at payment step when eligible—the system shows only active promotions valid for current date, time, store, and customer tier (if loyalty is enabled). Select the promotion from the list, confirm the discount applies correctly to the cart total, then complete payment.\n\n' +
          'Complete payment (cash, card, mobile payment, or split payment) to close the ticket and finalize the order. Partial payments or unpaid tickets remain on the order board in "Pending Payment" status until settled. Only fully paid orders print final receipts and update daily sales totals.',
        tip: 'Train cashiers to confirm order type (dine-in vs. takeaway) with every customer—this affects kitchen priority (dine-in may need plates/cutlery, takeaway needs packaging), analytics accuracy (track which sales channel drives revenue), and in some regions, tax rates (dine-in and takeaway can have different VAT treatment). Always ask "For here or to go?" before sending to kitchen.',
      },
      {
        heading: 'Monitor the order board',
        body:
          'Register → Order board lists open tickets, statuses, and table links. Use it to chase long-running orders or fix wrong table assignments before payment.\n\n' +
          'During busy service, designate one person to watch the board if counters split duties.',
      },
      {
        heading: 'Run the kitchen display',
        body:
          'Kitchen role users see new items and mark preparation progress. Mark items or whole orders ready so front-of-house knows when to run food.\n\n' +
          'Clear statuses promptly; stale “preparing” flags slow down the whole line.',
      },
      {
        heading: 'Close sessions and run day-end',
        body:
          'Cashiers close their sessions at shift end by navigating to Cashier Session → Close Session and entering the counted cash amount in the drawer (actual physical cash after their shift). The system compares actual cash against expected cash (opening float + cash sales - cash refunds/voids) and reports any overage (extra cash) or shortage (missing cash).\n\n' +
          'Example: Sarah closes Session #2847 at 5 PM:\n' +
          '- Opening Float: Rs. 5,000\n' +
          '- Cash Sales during shift: Rs. 18,500 (37 cash transactions)\n' +
          '- Cash Refunds: Rs. 850 (1 refund)\n' +
          '- Expected Cash: Rs. 5,000 + Rs. 18,500 - Rs. 850 = Rs. 22,650\n' +
          '- Actual Cash Counted: Rs. 22,400\n' +
          '- Variance: -Rs. 250 (shortage)\n\n' +
          'The system flags the Rs. 250 shortage. Sarah and the manager review transactions to identify the cause (for example, incorrect change given, transaction not recorded, or theft). The shortage is documented in Session #2847 report for management review and corrective action.\n\n' +
          'Example - Balanced session: Ravi closes Session #2848 at 9 PM:\n' +
          '- Expected: Rs. 31,200\n' +
          '- Actual: Rs. 31,200\n' +
          '- Variance: Rs. 0 (balanced, no discrepancy)\n\n' +
          'Managers review all closed sessions on Admin → Cashier Sessions or POS → Cash Sessions to see:\n' +
          '- Which cashier worked which hours (Sarah: 9 AM - 5 PM, Ravi: 1 PM - 9 PM)\n' +
          '- How much each cashier sold (Sarah: Rs. 24,000 total, Ravi: Rs. 38,000 total)\n' +
          '- Cash vs. card split per session (Sarah: 60% cash / 40% card)\n' +
          '- Any variances or discrepancies (Sarah -Rs. 250, Ravi Rs. 0)\n\n' +
          'Run the day-end report (POS → Reports → Day-End Summary or Admin → Analytics → Daily Summary) for totals across all sessions, all cashiers, and all payment methods for that calendar day and store. The day-end report aggregates:\n' +
          '- Total revenue (Rs. 62,000 for the day)\n' +
          '- Order count (142 orders)\n' +
          '- Average order value (Rs. 62,000 / 142 = Rs. 437)\n' +
          '- Payment method breakdown (Cash Rs. 38,000, Card Rs. 20,000, Mobile Rs. 4,000)\n' +
          '- Discounts given (Promotions: Rs. 3,200, Manager overrides: Rs. 450)\n' +
          '- Refunds/voids (Rs. 1,200 total)\n' +
          '- Top-selling items (Latte: 48 sold, Turkey Sandwich: 22 sold)\n' +
          '- Category performance (Hot Drinks: Rs. 28,000, Food: Rs. 22,000, Desserts: Rs. 12,000)\n\n' +
          'Use day-end reports for daily reconciliation with bank deposits, accounting entries, and performance tracking. Compare today\'s totals against yesterday and last week to spot trends (for example, Monday sales consistently lower than Friday, indicating you might reduce Monday staffing).',
        tip: 'Resolve voids, refunds, and manager discount approvals BEFORE running day-end so totals accurately reflect what actually happened during the day. If you discover a Rs. 500 void was entered incorrectly after day-end closes, you will need to manually adjust accounting records or re-run reports—much easier to catch and fix errors before closing the day. Have managers review and approve all voids and large discounts during the shift, not after close.',
      },
    ],
    outcome: 'Orders flow from register to kitchen to payment, sessions reconcile cash, and day-end reflects the store’s actual day.',
  },
  {
    id: 'tables-qr',
    slug: 'tables-qr',
    title: '8. Tables & QR ordering (add-on)',
    summary: 'Enable the QR add-on, configure tables, and run guest scan-to-order service.',
    overview:
      'Table service with QR ordering lets guests scan a code at the table, browse your menu on their phone, and submit orders without a waiter taking the initial order. Staff fulfill through the same POS order board and kitchen display.\n\n' +
      'This capability requires the QR Ordering add-on on Admin → Add-ons with payment completed if billed. Without an active add-on, table and QR tools stay unavailable.\n\n' +
      'Plan physical QR placement (laminated cards, stands, or stickers) and train staff to link incoming QR tickets to tables on the order board.',
    prerequisites: [
      'QR Ordering add-on subscribed and paid',
      'Menu complete with items guests should see online',
      'Tables defined with clear names or numbers for staff',
      'Network or printing approach for QR codes at each table',
    ],
    steps: [
      {
        heading: 'Subscribe to QR ordering',
        body:
          'Open Admin → Add-ons, find "QR Ordering" in the available add-ons list, and click Enable or Subscribe. If this is a paid add-on, the system prompts for payment: enter payment details (bank transfer with receipt for Sri Lanka LKR accounts, or PayPal/Stripe for online payment) and complete the transaction. Confirm the add-on shows "Active" status on Admin → Subscription page before configuring tables or printing QR codes.\n\n' +
          'Example: Urban Bistro (Sri Lanka, LKR billing) enables QR Ordering:\n' +
          '- Add-on cost: LKR 3,000/month\n' +
          '- Current billing period: 20 days remaining until May 31\n' +
          '- Prorated charge: (20/31) × LKR 3,000 = LKR 1,935\n' +
          '- Payment: Completed via Stripe card payment\n' +
          '- Status: Active immediately after payment\n' +
          '- Next renewal: Full LKR 3,000 will bill on June 1 with main subscription\n\n' +
          'Example: Sunset Café (USA, USD billing) enables QR Ordering:\n' +
          '- Add-on cost: $30/month (USD pricing for international accounts)\n' +
          '- Prorated charge: $15 (mid-cycle activation)\n' +
          '- Payment: PayPal\n' +
          '- Status: Active\n\n' +
          'International accounts (billed in USD) pay USD add-on pricing configured by the platform administrator (for example, QR Ordering $30/month, Loyalty $25/month); Sri Lanka accounts (billed in LKR) see LKR add-on pricing (for example, QR Ordering LKR 3,000, Loyalty LKR 2,500). Pricing may differ between regions based on platform settings and currency conversion policies. Confirm the exact amount and currency on the Add-ons page before subscribing to avoid billing surprises.',
        tip: 'Enable QR Ordering early in your billing cycle (day 1 or 2 after plan renewal) to minimize prorated partial charges and simplify accounting. If you enable on day 28 of a 31-day month, you pay a small proration now (3 days) and the full monthly amount in 3 days, creating two charges in quick succession—wait until after renewal to consolidate into one charge.',
      },
      {
        heading: 'Create tables and QR codes',
        body:
          'Navigate to POS → Café Tables & QR (or similar menu item for table management). Create each table with a label or number that staff recognize instantly (for example, "Table 1," "Table 2," "Patio A," "Window Booth 3"). Keep labels short, clear, and unambiguous—avoid creative names like "Sunset Corner" that confuse new staff; use simple identifiers like "T1," "T2," "Bar-1" that map directly to physical locations.\n\n' +
          'Example: Urban Bistro creates tables for their dining room:\n' +
          '- Indoor: Table 1, Table 2, Table 3, Table 4, Table 5, Table 6\n' +
          '- Outdoor Patio: Patio A, Patio B, Patio C\n' +
          '- Bar Seating: Bar-1, Bar-2, Bar-3\n' +
          'Total: 12 tables\n\n' +
          'For each table, the system generates a unique QR code linked to that table\'s guest ordering URL (for example, https://order.cafinity.io/urbanbistro/table/1 for Table 1, https://order.cafinity.io/urbanbistro/patio-a for Patio A). When scanned, this QR code opens the guest-facing menu on the customer\'s smartphone, pre-filled with the table identifier so orders automatically attach to the correct table.\n\n' +
          'Download or print QR codes directly from the table management interface (usually a "Download QR" or "Print QR" button next to each table). Options typically include:\n' +
          '- Download as PNG/SVG image (for custom signage design in Photoshop, Canva, etc.)\n' +
          '- Print individual QR code sheets (one table per page, ready to laminate)\n' +
          '- Batch print all QR codes (entire venue in one PDF, useful for initial rollout)\n\n' +
          'Example workflow: Urban Bistro clicks "Print All QR Codes," receives a PDF with 12 pages (one per table). They print on heavy cardstock paper, laminate each sheet to protect from spills and wear, and place in acrylic stands on each table. Alternatively, they download PNG files and design branded table tents in Canva (logo, QR code, "Scan to order" instruction), then print and laminate.\n\n' +
          'Place codes where guests naturally scan them—center of the table, near the condiments, on the wall next to booth seating. Make QR codes large enough to scan from a normal sitting distance (at least 2x2 inches / 5x5 cm; bigger is better for visibility). Avoid placing QR codes under glass or plastic that creates glare or distortion—flat laminated paper or acrylic stands work best. Include simple instructions near the QR code: "Scan to view menu and order from your phone" or "Scan here to order →" with an arrow pointing to the code.\n\n' +
          'Test one table yourself before rolling out floor-wide: Sit at Table 1, scan the QR code with your phone, verify the menu loads correctly, place a test order (for example, 1x Coffee), and confirm the order appears on the POS order board with the correct table assignment ("Table 1"). Cancel or complete the test order, then repeat the test on a different table to ensure unique table identifiers are working. Only after successful testing should you deploy QR codes to all tables.',
        tip: 'Use durable materials for QR code displays—laminated paper or waterproof acrylic stands. Paper QR codes without protection will fade, tear, or get stained from food and drinks within weeks. Reprint and replace QR codes if they become illegible or damaged (customers will not scan dirty, crumpled codes). If you rearrange your dining room or add/remove tables, update table labels in the POS and reprint affected QR codes so table assignments stay accurate.',
      },
      {
        heading: 'Operate during service',
        body:
          'When guests scan and order, tickets appear on the POS order board and kitchen like cashier-entered orders. Staff confirm table assignment and fire items to the kitchen as usual.\n\n' +
          'Watch for duplicate orders from guests reordering on their phones—use the board to merge or void per your house policy.',
        tip: 'Brief hosts to tell guests to scan the code on their table, not an old flyer, after you reprint QRs.',
      },
    ],
    outcome: 'Guests can order from their table via QR, and staff see those orders in the same POS workflows as counter service.',
  },
  {
    id: 'promotions',
    slug: 'promotions',
    title: '9. Promotions',
    summary: 'Create, approve, and apply percentage, flat, bundle, Buy X Get Y, and flat-price promotions at checkout.',
    overview:
      'Promotions reduce price or change basket behavior at checkout. The platform supports five types: percentage discounts take a percent off items or orders; flat discounts subtract a fixed amount; bundle deals sell multiple items together at one price; Buy X Get Y offers reward quantity purchases with free products; flat-price promotions set one low price for selected items during a window.\n\n' +
      'Managers typically create promotions in the POS where they understand daypart and menu constraints. Some venues require merchant admin approval before a promotion goes live—use approval workflows so discounted selling is deliberate, not accidental.\n\n' +
      'Applied discounts appear on receipts and feed analytics so you can measure promotion lift versus margin. Choose the type that matches your campaign goal: percentage or flat for broad sales, bundles for meal deals, Buy X Get Y for inventory rotation, and flat pricing for happy hour or slow-hour traffic.',
    prerequisites: [
      'Manager or merchant admin POS access',
      'Clear rules for who may create versus approve promotions',
      'Menu items and categories stable enough to target promotions',
      'Understanding of margin and ideal discount depth per promotion type',
    ],
    steps: [
      {
        heading: 'Percentage discount — percent off items or orders',
        body:
          'Open Admin → Promotions (or POS → Promotions if manager role), click Create promotion, and name it something descriptive (for example, Weekend Beverage Sale). Set type to Percentage discount and enter the discount percent (for example, 20).\n\n' +
          'Choose scope: select the Beverages category if you want all drinks discounted, or pick individual items for narrower targeting. Set start and end dates so the promotion is only active Saturday and Sunday (or your chosen window). Leave min order amount blank unless you only want the discount on orders above a threshold—add a minimum if you need to protect margin on small tickets.\n\n' +
          'Save the promotion. If approval is required in your workflow, it enters pending state until a merchant admin reviews it on Admin → Promotions. When active, a customer ordering a $6 latte sees $4.80 at checkout (20% off), and the receipt shows Weekend Beverage Sale: -$1.20.',
        tip: 'Use max discount amount if you apply percentage discounts order-wide and want to cap how much very large baskets can save.',
      },
      {
        heading: 'Flat discount — fixed amount off items or orders',
        body:
          'Create a promotion and name it Sandwich Special with description "$3 off any sandwich". Set type to Flat discount and discount amount to 3. Choose scope: select the Sandwiches category or individual sandwich items so the discount applies only where intended.\n\n' +
          'Set start and end dates for the campaign duration. Optionally add a min order amount (for example, 15) if you only want the $3 off when the total is at least $15—this prevents giving the discount on orders too small to justify the margin hit.\n\n' +
          'Save and approve if your workflow requires it. A $10 turkey sandwich is sold for $7 when the promotion is active; receipt line reads Sandwich Special: -$3.00.',
        tip: 'Use max discount amount to cap the flat discount when you apply it order-wide and sell very expensive items—prevents disproportionate reductions.',
      },
      {
        heading: 'Bundle deal — sell multiple items at one price',
        body:
          'Create a promotion named Lunch Combo with description "Burger + Fries + Soda for $12". Set type to Bundle deal. Add bundle items by selecting each product (Burger, Fries, Soda) and setting quantity to 1 for each.\n\n' +
          'Enter bundle price as 12. If individual prices total $17, the customer saves $5 on the combo. Set dates to weekdays during lunch rush or all week if it is a permanent offer.\n\n' +
          'Save and approve. Cashiers apply Lunch Combo at checkout when a customer orders those exact items; the register shows individual items (Burger $8, Fries $4, Soda $5) then applies the promotion to reduce the total to $12. Receipt reads Lunch Combo bundle: $12.00 (saved $5.00).',
        tip: 'Bundles work best when the items are frequently ordered together—avoid obscure combos guests rarely want or cannot visualize.',
      },
      {
        heading: 'Buy X Get Y — reward quantity with free products',
        body:
          'Create a promotion named Coffee Loyalty with description "Buy 2 coffees, get 1 free". Set type to Buy X Get Y. Choose buy product as Coffee from your menu and set buy quantity to 2. Choose free product as Coffee again (same item) and set free quantity to 1.\n\n' +
          'Set dates for ongoing or limited-time. Save the promotion. When a customer orders 3 coffees at $4 each (total $12), the promotion applies and they pay for 2 ($8), getting the third free. Receipt shows Coffee Loyalty: -$4.00.\n\n' +
          'You can vary the setup: set buy product to any entree item or category and free product to any dessert—this clears dessert inventory and drives cross-category upsell (for example, Buy any entree, get dessert free).',
        tip: 'This type drives repeat visits and higher basket sizes—promote it visibly so guests know to order the threshold quantity to qualify.',
      },
      {
        heading: 'Flat price — one low price for selected items',
        body:
          'Create a promotion named Happy Hour Pizzas with description "Any large pizza $15, 4–6 PM". Set type to Flat price. Choose scope by selecting all large pizza items (Margherita, Pepperoni, Veggie) or the Large Pizzas category.\n\n' +
          'Enter flat price as 15. If your pizzas normally range $18–$22, this sets all of them to $15 during the promotion window. Set dates and times to cover weekdays from 4 PM to 6 PM (start and end dates span the campaign period; time eligibility is managed by active hours or manual toggle).\n\n' +
          'Save and approve. During happy hour, a customer ordering a $22 Deluxe Pizza sees it ring up at $15 regardless of original price. Receipt shows Happy Hour Pizzas: final price $15.00 (saved $7.00).',
        tip: 'Flat-price promotions are powerful for evening or slow-hour traffic—guests perceive high value when premium items drop to one low price.',
      },
      {
        heading: 'Set min order, max discount, and loyalty tier restrictions',
        body:
          'Use min order amount to require a minimum basket total before the promotion applies (for example, $10 off orders over $50 prevents tiny orders from getting disproportionate discounts). Use max discount amount to cap how much a percentage or flat discount can reduce the bill (for example, 20% off, max $20 discount ensures very large orders do not get excessive reductions).\n\n' +
          'If loyalty is enabled, set min tier level to restrict the promotion to customers at or above a tier (for example, Gold members only: 25% off rewards your best guests and encourages tier advancement). Choose store scope to target one location for local events or branch-specific inventory, or tenant scope to apply the promotion at all sites.\n\n' +
          'Use the active toggle to control whether the promotion is live without deleting it—turn off after a campaign ends, then reactivate for the next cycle without rebuilding rules.',
      },
      {
        heading: 'Approve or reject (when required)',
        body:
          'Merchant admins review submissions on Admin → Promotions (filter by pending). Check that discount depth, scope, and dates align with business goals and margin targets.\n\n' +
          'Approve to make the promotion live so cashiers can apply it at checkout immediately. Reject and provide a reason (for example, Discount too high for margin or Dates conflict with existing sale) so the manager can revise and resubmit. Consistent approval discipline prevents margin erosion from overly generous or conflicting promotions.',
      },
      {
        heading: 'Apply at checkout',
        body:
          'Cashiers attach eligible promotions during payment on the register. The promotion list shows only active deals valid for the current date, store, and (if applicable) customer tier. Select the promotion name, confirm the discount or bundle price appears, then complete payment. The discount breakdown prints on the receipt when configured.\n\n' +
          'If a promotion does not appear in the list, verify dates are current, store scope matches the active store, min order threshold is met, applicable items are in the cart, and approval status is approved before manually overriding price.',
        tip: 'Train cashiers to recognize promotion names and eligibility windows—Happy Hour Pizzas only works 4–6 PM; applying it at 8 PM will fail validation.',
      },
      {
        heading: 'Monitor performance and adjust',
        body:
          'Use Admin → Analytics or POS → Dashboard to review promotion usage: how many times applied, total discount given, revenue impact, and which items sold under each deal. Compare sales during promotion periods versus baseline to measure lift.\n\n' +
          'If a bundle is not moving, adjust the price or swap an item; if a percentage discount costs too much margin, lower the percent or add a min order threshold. Turn off underperforming promotions and iterate—your menu and guest behavior will guide what deals resonate.',
      },
    ],
    outcome: 'You can create and manage percentage, flat, bundle, Buy X Get Y, and flat-price promotions with approval controls, apply them accurately at checkout, and measure their impact on revenue and margin.',
  },
  {
    id: 'loyalty',
    slug: 'loyalty',
    title: '10. Loyalty program (add-on)',
    summary: 'Enable loyalty, configure tiers and rewards, and redeem at checkout.',
    overview:
      'Loyalty rewards repeat customers with points, tiers, or automatic benefits tied to their profile. Enable the loyalty add-on on Admin → Add-ons before configuring rules in Admin → Loyalty admin.\n\n' +
      'Define how customers earn points and what rewards they can redeem. Cashiers attach a customer at checkout to accrue value and redeem rewards in the same flow.\n\n' +
      'Loyalty works alongside the Customers area—profiles, balances, and tier status should stay accurate for front-of-house trust.',
    prerequisites: [
      'Loyalty add-on subscribed and active',
      'Merchant admin access for program configuration',
      'Staff trained to attach customers at the register',
      'Rewards and tiers defined with clear earn and burn rules',
    ],
    steps: [
      {
        heading: 'Enable the loyalty add-on',
        body:
          'Navigate to Admin → Add-ons, find "Loyalty Program" in the available add-ons list, and click Enable or Subscribe. Complete payment if this is a paid add-on (bank transfer with receipt for Sri Lanka LKR accounts, PayPal/Stripe for online payment, depending on your region and billing currency). After payment is verified, go to Admin → Loyalty Admin to access the full loyalty configuration dashboard. Confirm the program status shows "Active" before announcing the loyalty program to customers or training staff on redemption workflows.\n\n' +
          'Example: Green Leaf Café (Sri Lanka) enables Loyalty:\n' +
          '- Add-on cost: LKR 2,500/month\n' +
          '- Prorated charge for first month: LKR 1,613 (20 days remaining)\n' +
          '- Payment method: Bank transfer, receipt uploaded\n' +
          '- Verification: 1 business day\n' +
          '- Status after approval: Active\n' +
          '- Configuration access: Admin → Loyalty Admin now visible\n\n' +
          'Without the active Loyalty add-on, loyalty menus, customer points accrual, tier management, and redemption features stay hidden or disabled across the admin portal and POS. Attempting to attach customers or redeem rewards without an active add-on will fail with an error message.',
        tip: 'Before enabling the Loyalty add-on, plan your program structure: decide on earning rules (for example, Rs. 10 spent = 1 point), tier thresholds (Bronze at 0 points, Silver at 500 points, Gold at 1,500 points), and rewards (for example, 100 points = Rs. 50 discount). Having a clear plan before activation makes configuration faster and avoids confusing customers with mid-stream rule changes.',
      },
      {
        heading: 'Configure tiers and rewards',
        body:
          'Open Admin → Loyalty Admin to define how customers earn points, tier thresholds, and what rewards they can redeem. Start with earning rules: set how much spending equals one point (for example, Rs. 100 spent = 1 point, or $10 spent = 1 point). Define tier thresholds: point or spend levels that promote customers to higher tiers with better benefits.\n\n' +
          'Example tier structure for Green Leaf Café (Sri Lanka):\n' +
          '**Bronze Tier (default, 0 points)**\n' +
          '- Earning rate: Rs. 100 spent = 1 point\n' +
          '- Benefits: Birthday discount (10% off), early access to new menu items\n\n' +
          '**Silver Tier (500 points or Rs. 50,000 lifetime spend)**\n' +
          '- Earning rate: Rs. 100 spent = 1.5 points (50% bonus)\n' +
          '- Benefits: Free drink on signup anniversary, 15% birthday discount, priority seating\n\n' +
          '**Gold Tier (1,500 points or Rs. 150,000 lifetime spend)**\n' +
          '- Earning rate: Rs. 100 spent = 2 points (double points)\n' +
          '- Benefits: Free drink every month, 20% birthday discount, VIP event invitations, personalized service\n\n' +
          'Define redeemable rewards: what customers can exchange their points for. Examples:\n' +
          '- 50 points → Rs. 100 discount on next purchase\n' +
          '- 100 points → Free pastry (any item under Rs. 300)\n' +
          '- 200 points → Free drink (any beverage)\n' +
          '- 500 points → Rs. 1,000 discount or free combo meal\n\n' +
          'Set automatic tier benefits (perks that apply without redemption): for example, Gold members always get 10% off every purchase, or Silver members get free delivery on orders over Rs. 2,000. These benefits apply automatically at checkout when a qualifying customer is attached to the order—no manual redemption required.\n\n' +
          'Use simple thresholds and earning rates first—you can refine complexity after you see real customer earning behavior and redemption patterns in analytics. Avoid overly complicated rules (for example, "2x points on Tuesdays for beverages only, but 3x for Gold members if order is over Rs. 1,000") that confuse staff and customers. Start with straightforward earning (Rs. 100 = 1 point for everyone) and clear rewards (100 points = free coffee), then iterate based on data.',
        tip: 'Design your loyalty program economics carefully: if customers earn 1 point per Rs. 100 spent and can redeem 100 points for Rs. 200 value, you are giving back 2% of revenue (Rs. 10,000 spent earns 100 points, redeems for Rs. 200 = 2% give-back). Calculate your target loyalty give-back percentage (typically 2-5% of revenue) and reverse-engineer earning and redemption rates to match. Too generous and you erode margins; too stingy and customers will not engage with the program.',
      },
      {
        heading: 'Maintain customer profiles',
        body:
          'Use Admin → Customers (for merchant admin access) and POS → Customers (for manager/cashier access at the register) to search for existing customers, create new customer profiles, and update contact details or loyalty information. Search by phone number (most common, for example +94 77 123 4567) or email (customer@example.com) before creating a new profile to avoid duplicates.\n\n' +
          'Example: A customer visits Green Leaf Café and asks to join the loyalty program. Cashier Sarah opens POS → Customers, clicks "Add Customer," and enters:\n' +
          '- Name: Nimal Perera\n' +
          '- Phone: +94 77 234 5678\n' +
          '- Email: nimal.perera@email.com\n' +
          '- Birthday: March 15 (for birthday rewards)\n' +
          '- Tier: Bronze (default for new signups)\n' +
          '- Points Balance: 0\n\n' +
          'Profile is saved and immediately available for order attachment. Next visit, Sarah searches "77 234 5678" in Customers, finds Nimal\'s profile, and attaches it to his order so he earns points. If Nimal provides a different phone number at next visit, Sarah searches both numbers to avoid creating a duplicate—if found, she updates the profile with the secondary phone number for future reference.\n\n' +
          'Fix misspelled names, incorrect phone numbers, or wrong email addresses early (within days of signup) so points consolidate on one accurate record. Duplicate profiles fragment a customer\'s loyalty data: if Nimal has two profiles (one with +94 77 234 5678 and another with +94 77 234 5679 due to a typo), his points split across both, and he cannot redeem his full balance. Use the search function to find and merge duplicates: locate both profiles, manually transfer points from the duplicate to the primary profile, then archive or delete the duplicate.\n\n' +
          'Managers can manually adjust customer points balances when policy allows (for example, compensating a customer for service failures, correcting system errors, or applying promotional bonus points). When adjusting balances, log the reason in internal notes or a separate tracking document: "Added 50 points on May 20, 2026 - compensation for delayed order" so there is an audit trail for accounting and customer service. Never adjust balances without documenting why—unexplained point changes create disputes and confusion.',
        tip: 'Ask customers for one consistent identifier at signup (usually mobile phone number) to keep one profile per person. Mobile numbers are more stable than email addresses (people rarely change phone numbers but often change email providers). Train staff to search by phone first, then email if phone search fails, before creating new profiles. Implement a policy: "Always search before creating new customer" to minimize duplicates from day one.',
      },
      {
        heading: 'Redeem at checkout',
        body:
          'Cashiers attach the customer to the order before payment, then apply eligible rewards. Confirm the receipt shows points earned or redeemed as expected.\n\n' +
          'If redemption fails, verify tier status and reward availability before comping manually.',
      },
    ],
    outcome: 'Loyalty is live, customers earn and redeem benefits at checkout, and profiles reflect current tiers and points.',
  },
  {
    id: 'analytics',
    slug: 'analytics',
    title: '11. Analytics & reporting',
    summary: 'Revenue, order volume, top items, and recent orders—with currency from branding.',
    overview:
      'Analytics turns completed sales into charts and lists leaders use to steer the business. Admin → Analytics offers the full date-range and store-filter experience; POS → Dashboard exposes the same metrics APIs for managers on the floor.\n\n' +
      'All monetary figures use the currency you set in Admin → Branding & Settings. Dashboards and admin charts label amounts with that symbol so Sri Lanka and international tenants each see consistent formatting without per-report setup.\n\n' +
      'Some aggregates update on different schedules: order volume from completed orders is timely; top-selling item rollups may refresh every few minutes depending on server sync. Recent orders always reflect live order data.',
    prerequisites: [
      'Branding currency configured',
      'At least some completed paid orders for meaningful charts',
      'Store filter understood if you operate multiple locations',
      'Manager or merchant admin access to admin analytics or POS dashboard',
    ],
    steps: [
      {
        heading: 'Use admin analytics',
        body:
          'Open Admin → Analytics, select a store from the store filter dropdown (or "All Stores" if you want aggregated data across all locations), and pick a date range (for example, "Last 7 Days," "This Month," "May 1 - May 31"). The dashboard displays:\n\n' +
          '**Revenue metrics:**\n' +
          '- Total Revenue: Rs. 485,000 (or $4,850 if USD billing)\n' +
          '- Average Order Value: Rs. 1,245\n' +
          '- Revenue by day: Line chart showing daily totals (for example, May 20: Rs. 68,000, May 21: Rs. 72,000)\n\n' +
          '**Order volume:**\n' +
          '- Total Orders: 389 orders completed and paid\n' +
          '- Orders by type: Dine-in 210 (54%), Takeaway 150 (39%), Delivery 29 (7%)\n' +
          '- Peak hours: Bar chart showing busiest times (for example, 8-10 AM: 98 orders, 12-2 PM: 145 orders)\n\n' +
          '**Category performance:**\n' +
          '- Hot Drinks: Rs. 198,000 (41% of revenue)\n' +
          '- Food: Rs. 165,000 (34%)\n' +
          '- Cold Drinks: Rs. 78,000 (16%)\n' +
          '- Desserts: Rs. 44,000 (9%)\n\n' +
          '**Top-selling items:**\n' +
          '1. Latte - 142 sold - Rs. 63,900 revenue\n' +
          '2. Turkey Club Sandwich - 68 sold - Rs. 57,800\n' +
          '3. Cappuccino - 89 sold - Rs. 44,500\n' +
          '4. Espresso - 95 sold - Rs. 23,750\n' +
          '5. Chocolate Brownie - 52 sold - Rs. 18,200\n\n' +
          '**Promotion impact:**\n' +
          '- Morning Rush Special: Applied 45 times, total discount Rs. 4,725, revenue attributed Rs. 38,000\n' +
          '- Lunch Combo: Applied 22 times, discount Rs. 3,300, revenue Rs. 18,700\n\n' +
          '**Recent orders (live feed):**\n' +
          '- Order #2847 - Table 5 - Rs. 1,850 - Paid - 2 minutes ago\n' +
          '- Order #2846 - Takeaway - Rs. 650 - Paid - 8 minutes ago\n' +
          '- Order #2845 - Delivery - Rs. 2,400 - Preparing - 15 minutes ago\n\n' +
          'Compare periods of equal length before drawing conclusions about trends: compare "May 1-7" with "April 24-30" (both 7-day periods) rather than comparing a 7-day week with a 3-day weekend. Use consistent date ranges when measuring campaign effectiveness: "2 weeks before promotion launch" vs. "2 weeks during promotion" gives clearer lift analysis than comparing unequal periods.',
        tip: 'Use the date range picker to measure specific events: compare the week of a promotion launch against the week before to measure lift. Filter by store when diagnosing location-specific issues (for example, one store has declining sales while others are stable). Export data to CSV for deeper analysis in Excel or Google Sheets when you need custom calculations or charts not available in the dashboard.',
      },
      {
        heading: 'Use the POS manager dashboard',
        body:
          'Managers open POS → Dashboard for the selected store to see sales charts, order volume, top items, and recent orders without leaving the floor.\n\n' +
          'Confirm the navigation bar shows the intended store—dashboard totals follow the active store, not all locations at once.',
        tip: 'Currency labels on both admin and POS dashboards come from branding; if symbols look wrong, fix currency there first, not in analytics.',
      },
      {
        heading: 'Interpret timing and delays',
        body:
          'Order volume reflects completed orders as they finish. Top seller rankings may lag slightly while background sync aggregates item lines.\n\n' +
          'Use recent orders for real-time pulse checks; use top items for menu engineering after the sync window.',
      },
    ],
    outcome: 'You can read store performance in admin or POS with correct currency labels and realistic expectations for data freshness.',
  },
  {
    id: 'notifications',
    slug: 'notifications',
    title: '12. Notifications',
    summary: 'In-app bell alerts and billing emails for important events.',
    overview:
      'Notifications keep merchant admins aware of billing, approvals, and operational events without polling every page. A bell icon in the admin portal and POS surfaces unread items in one list.\n\n' +
      'Critical subscription and payment events also send email to merchant admin addresses on file. Treat email as the durable audit trail when in-app alerts are dismissed.\n\n' +
      'Encourage owners to monitor notifications during trial end, payment verification, and plan change windows.',
    prerequisites: [
      'Valid merchant admin email on the account',
      'Access to admin portal or POS with bell icon visible',
      'Understanding of which events are billing versus operational',
    ],
    steps: [
      {
        heading: 'Check in-app alerts',
        body:
          'Click the bell icon 🔔 in the admin portal header (top-right corner) or POS navigation bar to open the notification dropdown list. Notifications are organized by type and recency, showing the most recent alerts first. Read each item carefully and follow any embedded links to the relevant page (for example, "Payment verification pending" links to Admin → Subscription, "Manager approval required for promotion" links to Admin → Promotions).\n\n' +
          'Example notifications Green Leaf Café might see:\n\n' +
          '**Billing & Subscription:**\n' +
          '- "Trial ending in 3 days - Complete payment to continue service" (urgent, links to Subscription)\n' +
          '- "Bank transfer verified - Subscription active until June 30" (confirmation)\n' +
          '- "Payment due June 1 - Rs. 20,500 for monthly renewal" (reminder 3 days before due date)\n\n' +
          '**Operational:**\n' +
          '- "New promotion pending approval: Weekend Special 20% off" (action required for merchant admin)\n' +
          '- "Low stock alert: Coffee Beans - 8kg remaining (min 10kg)" (informational, links to Inventory)\n' +
          '- "Cashier session #2847 closed with -Rs. 250 shortage" (alert, links to Session report)\n\n' +
          '**Customer & Loyalty:**\n' +
          '- "New customer signup: Nimal Perera" (informational)\n' +
          '- "Customer tier upgraded: Sarah Silva promoted to Gold" (informational)\n\n' +
          'Mark notifications as read after you act on them (by clicking, dismissing, or using a "Mark Read" button) so the team knows what is still outstanding and needs attention. Unread notifications typically show with a blue dot 🔵 or bold text; read notifications appear grayed out or with normal text weight. The bell icon shows a badge with the count of unread notifications (for example, 🔔10 means 10 unread alerts).',
        tip: 'Check notifications at the start of every shift and before processing payments or making configuration changes. Missing a "Trial ending" or "Payment failed" notification can lead to service interruption. Enable browser notifications if available so critical alerts reach you even when not actively using Cafinity (for example, desktop pop-up: "Payment verification failed - action required").',
      },
      {
        heading: 'Respond to billing notifications',
        body:
          'Payment verification, trial ending, failed renewal, and plan change confirmations often appear as both bell alerts and email. Upload missing receipts or complete PayPal/Stripe flows from the linked Subscription page.\n\n' +
          'Do not ignore trial-ending notices—service interruption follows unpaid renewal after trial.',
      },
      {
        heading: 'Use email as backup',
        body:
          'Ensure merchant admin inboxes accept mail from Cafinity domains. Forward or archive billing emails for accounting.\n\n' +
          'If email stops arriving, verify the address on Admin → Users and spam filters before opening support tickets.',
      },
    ],
    outcome: 'You catch billing and operational events through the bell and email without missing verification or renewal deadlines.',
  },
  {
    id: 'customers',
    slug: 'customers',
    title: '13. Customers',
    summary: 'Customer records, loyalty attachment, and retention behavior.',
    overview:
      'Customer records store identity and contact details so you can attach repeat visitors to orders—especially when loyalty is enabled. Profiles live in Admin → Customers and POS → Customers for search at the register.\n\n' +
      'Attaching a customer at checkout links the order to their history, points, and tier. Even without loyalty, clean records help service and marketing outreach.\n\n' +
      'When loyalty retention rules are enabled, the platform may tier or adjust customers on a schedule based on spend—understand that automation before manual tier overrides.',
    prerequisites: [
      'Staff trained on privacy and consent for storing customer data',
      'Loyalty configured if you plan to earn or redeem points',
      'Process for correcting duplicate profiles (phone/email typos)',
    ],
    steps: [
      {
        heading: 'Create and search customers',
        body:
          'Navigate to Admin → Customers (merchant admin access) or POS → Customers (cashier/manager access) to view the customer database. Use the search bar to find customers by name, phone number (most reliable), or email address. Always search before creating a new profile to avoid duplicates—duplicate profiles fragment loyalty points and order history, frustrating customers.\n\n' +
          'Example: Cashier at Green Leaf Café searches for a customer:\n' +
          '1. Customer: "I\'m in your loyalty program, phone is 077 234 5678"\n' +
          '2. Cashier types "077 234 5678" in search box\n' +
          '3. System finds: Nimal Perera - +94 77 234 5678 - Bronze tier - 245 points\n' +
          '4. Cashier attaches this profile to the current order\n\n' +
          'If search finds no results, create a new customer profile by clicking "Add Customer" or "New Customer" button:\n' +
          '- Full Name: Dilani Silva\n' +
          '- Phone: +94 71 987 6543 (primary contact)\n' +
          '- Email: dilani.silva@example.com (optional, for email receipts and promotions)\n' +
          '- Birthday: July 10 (optional, for birthday rewards)\n' +
          '- Address: 789 Galle Road, Colombo 03 (optional, for delivery orders)\n' +
          '- Notes: Prefers almond milk, allergic to nuts (internal staff notes for personalized service)\n\n' +
          'After creating, the profile is immediately available for order attachment. New customers start at the default tier (usually Bronze or Basic) with zero points balance. They earn points on their first purchase if loyalty is active and the profile is attached at checkout.\n\n' +
          'Merge or retire duplicate profiles when you discover them during search: if you find "Nimal Perera +94 77 234 5678" and "Nimal P. +94 77 234 5679" (typo in phone number), consolidate points and order history onto the correct profile, update contact details, and archive the duplicate. Do not delete profiles with historical orders—archiving preserves data integrity for reports and analytics while hiding the profile from active searches.',
        tip: 'Train staff to confirm contact details verbally before creating profiles: "Is your phone number 077 234 5678?" rather than assuming spelling or number from verbal pronunciation. Typos and mishearing create duplicates ("Nimal" vs. "Nemal," "+94 77 123 4567" vs "+94 71 123 4567"). Use phone number as the primary identifier, not name or email, because names can be spelled multiple ways and emails change frequently. Standardize phone format: always use international format (+94 77 234 5678) or always use local format (077 234 5678), not a mix of both, to ensure search consistency.',
      },
      {
        heading: 'Attach customers at the register',
        body:
          'Before payment, attach the customer to the order in the register flow. Loyalty earn and burn requires an attachment on that ticket.\n\n' +
          'If the guest declines loyalty, you can still record the sale without attachment when policy allows.',
      },
      {
        heading: 'Review loyalty and retention',
        body:
          'In admin or POS customer views, check points, tier, and recent activity. When retention automation is on, tiers may update on a platform schedule from spend rules you configured in loyalty admin.\n\n' +
          'Explain tier changes to guests using your published program rules.',
        tip: 'Ask for one consistent identifier (usually mobile number) at signup to keep one profile per person.',
      },
    ],
    outcome: 'Customer records are accurate, attached when needed at checkout, and aligned with loyalty and retention rules.',
  },
  {
    id: 'tips',
    slug: 'tips',
    title: '14. Best practices',
    summary: 'Opening checklist, service habits, end of day, and support.',
    overview:
      'These practices help teams run reliably on Cafinity—not a separate product area, but habits that prevent billing surprises, wrong-store sales, and messy closes.\n\n' +
      'Treat configuration (subscription, branding currency, stores, users, menu) as stable infrastructure; treat daily operations (sessions, store selection, approvals) as shift discipline.\n\n' +
      'When something platform-wide fails, use the website contact form and keep payment receipts until bank transfers are verified.',
    prerequisites: [
      'Completed sections 1–13 or equivalent onboarding with your team',
      'Assigned owner for subscription and branding updates',
      'Shift leads trained on store switcher and cashier sessions',
    ],
    steps: [
      {
        heading: 'Before opening each day',
        body:
          'Confirm subscription is active, branding and currency are correct, the menu reflects today’s availability, the POS store switcher matches the physical site, and cashiers know how to open sessions.\n\n' +
          'Resolve pending promotion approvals so discounts work at open.',
      },
      {
        heading: 'During service',
        body:
          'Maintain operational discipline and use the platform correctly throughout the shift to ensure data accuracy, customer satisfaction, and smooth workflows:\n\n' +
          '**Store & Session Management:**\n' +
          '• Always keep the correct store selected in the POS store switcher (multi-location operators: if you switch stores mid-shift, all subsequent orders attach to the newly selected store—verify the store name in the navigation bar before every order during busy periods)\n' +
          '• Do not share cashier sessions (each person opens their own session; never log in with someone else\'s credentials or continue their open session)\n' +
          '• Monitor active sessions (managers: use POS → Sessions to see who is currently open and how long they have been logged in)\n\n' +
          '**Order & Kitchen Flow:**\n' +
          '• Monitor the order board regularly (Register → Order Board: check for orders stuck in "Preparing" for too long, chase kitchen if items are delayed beyond expected time)\n' +
          '• Use kitchen display correctly (kitchen staff: mark items "Preparing" when you start, "Ready" when complete, so front-of-house knows when to deliver food to tables)\n' +
          '• Update order status promptly (clear "Preparing" flags as soon as items are ready; stale statuses slow down the entire service line and cause confusion)\n\n' +
          '**QR & Table Service:**\n' +
          '• Use QR/table tools only when the QR Ordering add-on is active (attempting to use tables without an active add-on will fail or show errors)\n' +
          '• Verify table assignments on incoming QR orders (guests occasionally scan the wrong table\'s QR code; confirm with the guest if order says "Table 5" but they are seated at Table 7)\n' +
          '• Monitor QR order board (QR orders appear alongside cashier orders; treat them with equal priority to avoid long wait times for self-service guests)\n\n' +
          '**Loyalty & Customers:**\n' +
          '• Attach loyalty customers before payment (not after—points cannot be retroactively added to completed orders without manager intervention)\n' +
          '• Offer loyalty signup to repeat customers (train staff: "Would you like to join our rewards program? You\'ll earn points on today\'s purchase.")\n' +
          '• Verify customer identity before attaching profiles (ask for phone number or name; do not guess or attach the wrong customer profile, as this misallocates points)\n\n' +
          '**Promotions & Discounts:**\n' +
          '• Apply eligible promotions at checkout (check the promotions list before finalizing payment; inform customers: "You qualify for 15% off with our lunch special today")\n' +
          '• Do not manually override prices without manager approval (use the platform\'s promotion system; manual overrides bypass analytics and audit trails)\n' +
          '• Communicate promotion windows to customers (if Happy Hour is 4-6 PM, tell customers at 6:05 PM: "Happy hour just ended, but I can apply a standard discount if my manager approves")\n\n' +
          '**Issue Escalation:**\n' +
          '• Escalate repeated payment or sync issues to a merchant admin immediately (do not work around persistent problems by manually adjusting prices, voiding orders, or processing off-platform—report technical issues so they can be resolved properly)\n' +
          '• Document errors when they occur (note time, order number, affected items, error message, and what you were trying to do—this helps support diagnose and fix platform issues faster)\n' +
          '• Have a backup plan for platform downtime (rare, but prepare: can you take manual orders on paper, process card payments via standalone terminal, and enter data later when platform recovers?)\n\n' +
          'Example during-service scenario at Urban Bistro (busy Friday lunch):\n' +
          '12:15 PM - Cashier notices Latte button is unresponsive on register\n' +
          '12:16 PM - Tries refreshing POS browser page, issue persists\n' +
          '12:17 PM - Escalates to manager Priya: "Latte item not responding, can\'t add to cart"\n' +
          '12:18 PM - Priya checks POS → Menu, sees Latte is marked "Unavailable" accidentally (someone toggled it off during inventory check)\n' +
          '12:19 PM - Priya marks Latte "Available" again, cashier can now sell it\n' +
          '12:20 PM - Service resumes normally, no lost sales\n\n' +
          'Priya logs the incident in the shift notes: "Latte accidentally marked unavailable 12:15-12:19 PM, re-enabled. Remind staff not to toggle availability during service hours." This prevents recurrence and explains any dip in latte sales during that 4-minute window.',
        tip: 'Designate one person (usually the shift manager) to monitor the big picture during busy periods: watch order board for bottlenecks, check session balances, verify promotions are applying correctly. Front-line staff focus on customer interactions; managers focus on operational flow and issue resolution. During slow periods, train staff on edge cases: how to void an order, how to split payments, how to apply manager overrides—so they are prepared when those situations arise during rush.',
      },
      {
        heading: 'End of day',
        body:
          'Close the day with accurate financial reconciliation, operational review, and preparation for the next shift. Managers should complete this process within 30 minutes of closing doors to customers:\n\n' +
          '**Cashier Session Reconciliation:**\n' +
          '☑️ All cashiers close their sessions (each cashier: count cash drawer, enter actual cash amount, click Close Session)\n' +
          '☑️ Review session variances (Manager: POS → Sessions or Admin → Cashier Sessions, check for overages/shortages)\n' +
          '☑️ Document discrepancies immediately (if Session #2901 has -Rs. 500 shortage, interview cashier Sarah while memory is fresh: "Do you remember any transactions where change might have been incorrect?")\n' +
          '☑️ Secure cash for bank deposit (separate cash by session if policy requires, prepare deposit slip, lock in safe)\n\n' +
          'Example session reconciliation at Green Leaf Café (9 PM closing):\n' +
          '- Sarah (Session #2901): Expected Rs. 22,650, Actual Rs. 22,400, Variance -Rs. 250 (shortage)\n' +
          '- Ravi (Session #2902): Expected Rs. 31,200, Actual Rs. 31,200, Variance Rs. 0 (balanced)\n' +
          '- Manager Priya reviews with Sarah: identifies one transaction where Rs. 250 change was not returned to customer (honest mistake). Documents in incident log, provides retraining on change verification procedures.\n\n' +
          '**Analytics & Reporting:**\n' +
          '☑️ Run day-end report (POS → Reports → Day-End Summary or Admin → Analytics with today\'s date range)\n' +
          '☑️ Review key metrics:\n' +
          '  - Total revenue (compare to target: goal was Rs. 60,000, actual Rs. 62,000 = 3.3% over target ✅)\n' +
          '  - Order count (142 orders today vs. 138 yesterday = slight increase)\n' +
          '  - Average order value (Rs. 437 today vs. Rs. 425 last Friday = upselling working)\n' +
          '  - Top sellers (Latte still #1 with 48 sold, Sandwich #2 with 22 sold)\n' +
          '  - Payment method split (Cash 61%, Card 32%, Mobile 7%—normal distribution)\n' +
          '  - Discounts & promotions (Morning Boost applied 45 times, Rs. 4,725 total discount = 7.6% of revenue)\n\n' +
          '☑️ Compare to previous periods (today vs. yesterday, this Friday vs. last Friday, this week vs. last week)\n' +
          '☑️ Identify anomalies (for example, Desserts category down 40% today—was it marked unavailable? Did the oven break? Investigate before tomorrow\'s shift)\n\n' +
          '**Operational Cleanup:**\n' +
          '☑️ Clear void or approval queues (Admin → Approvals or POS → Manager Overrides: review and approve/reject any pending voids, refunds, or discounts awaiting manager sign-off)\n' +
          '☑️ Update menu availability for tomorrow (if you know certain items will be unavailable tomorrow—for example, Sunday delivery does not arrive until noon—mark them unavailable now so morning staff do not accidentally sell them)\n' +
          '☑️ Check inventory alerts (if critical items hit low stock today, ensure orders are placed with suppliers for next delivery: Milk at 8L, Coffee at 6kg—both below threshold, orders placed with suppliers for Monday delivery)\n' +
          '☑️ Review customer feedback or issues (any complaints logged during shift? Follow up tomorrow or assign to customer service)\n\n' +
          '**Documentation & Handoff:**\n' +
          '☑️ Note anomalies in shift log while facts are fresh ("Latte unavailable 12:15-12:19 PM due to accidental toggle," "Rs. 250 cash shortage Session #2901 - change error, retraining completed," "Desserts low sales - oven malfunction 3-5 PM, repaired by 5:30 PM")\n' +
          '☑️ Prepare notes for tomorrow\'s opener ("Milk low, delivery scheduled 10 AM Monday," "Croissants out of stock until bakery delivery 8 AM," "Promotion \'Weekend Special\' expires tonight, disable before Saturday open")\n' +
          '☑️ Update manager communication channels (post day-end summary in team Slack/WhatsApp: "Friday sales Rs. 62K, 142 orders, all sessions balanced except Sarah -Rs. 250. Great work team! 👏")\n\n' +
          'Example anomaly investigation: Urban Bistro notices "Turkey Club Sandwich" sales dropped from 25/day to 8/day on Friday. Manager Priya investigates:\n' +
          '1. Checks menu: Turkey Club is marked "Available" (not accidentally disabled)\n' +
          '2. Checks inventory: Turkey Breast at 0kg (Out of Stock alert)\n' +
          '3. Asks kitchen: "We ran out of turkey at 2 PM, been telling cashiers we can\'t make it"\n' +
          '4. Root cause: Inventory not updated when turkey ran out, cashiers did not mark item unavailable\n' +
          '5. Action: Marked Turkey Club unavailable at 2 PM going forward when stock depletes; trained staff to toggle availability immediately when ingredients run out\n' +
          '6. Documented in shift log: "Turkey Club out of stock 2 PM Friday, lost ~17 potential sales (Rs. 14,450 revenue). Process: kitchen notifies manager immediately when key ingredients deplete, manager marks items unavailable in POS to prevent customer disappointment."',
        tip: 'Resolve voids, refunds, and manager discount approvals BEFORE running day-end reports so financial totals accurately reflect completed transactions. If you discover a Rs. 500 void was entered incorrectly after day-end closes, manual accounting adjustments are required—much easier to catch and fix errors before finalizing the day. Have managers review and approve all voids, refunds, and large discounts during the shift (within 30 minutes of occurrence), not in a batch at close, to ensure accountability and prevent fraud. Schedule 30-45 minutes after closing for day-end procedures—do not rush reconciliation, as errors compound into larger accounting problems over days and weeks.',
      },
      {
        heading: 'Get support',
        body:
          'When you encounter platform defects, billing disputes, or technical issues you cannot resolve with the steps in this guide, contact Cafinity support through the official channels. Proper documentation and clear communication speeds up resolution:\n\n' +
          '**How to Contact Support:**\n' +
          '• Use the website contact form (typically https://www.cafinity.io/contact or https://www.cafinity.io/support)\n' +
          '• Email support: support@cafinity.io (if email address is provided on the website)\n' +
          '• In-app support: Click "Help" or "Support" link in admin portal or POS navigation (if available)\n' +
          '• Emergency hotline: Use the phone number provided in your approval email (for critical outages only: payment processor down, POS completely inaccessible, data loss)\n\n' +
          '**What to Include in Support Requests:**\n' +
          '1. **Your tenant/business name:** "Green Leaf Café" or tenant ID if known (helps support locate your account quickly)\n' +
          '2. **Issue category:** Billing, Technical (POS/Admin), Payment Gateway, Add-ons, Subscription, User Access, Menu/Inventory, Reports, QR Ordering, Loyalty\n' +
          '3. **Detailed description:** What you were trying to do, what happened instead, error messages (copy exact text or screenshot)\n' +
          '4. **Steps to reproduce:** How to trigger the issue consistently (for example, "Go to POS → Menu, click Edit on Latte item, change price from Rs. 450 to Rs. 500, click Save → Error: \'Invalid price format\'")\n' +
          '5. **User role and location:** Which role encountered the issue (Cashier, Manager, Merchant Admin), which store (Colombo Main, Kandy Branch)\n' +
          '6. **Timestamp:** When the issue occurred (for example, "May 21, 2026, 2:35 PM") so support can check server logs\n' +
          '7. **Browser/device info:** Chrome on Windows 11, Safari on iPad, Firefox on Android tablet\n' +
          '8. **Screenshots or screen recordings:** Visual evidence helps support understand the problem faster (use tools like Snipping Tool, Screenshot on mobile, or Loom for screen recordings)\n\n' +
          '**Example Support Request (Good):**\n' +
          'Subject: POS - Cannot mark inventory item as low stock\n\n' +
          'Tenant: Urban Bistro (merchant@urbanbistro.lk)\n' +
          'Issue: Technical - Inventory tracking\n' +
          'Store: Colombo Main\n' +
          'Role: Manager\n' +
          'Date/Time: May 21, 2026, 3:15 PM\n' +
          'Device: iPad Air, Safari browser\n\n' +
          'Description:\n' +
          'When I try to update inventory quantity for "Coffee Beans Dark Roast" from 12kg to 8kg (because we used 4kg today), the Save button is unresponsive. I can type the new quantity "8" in the field, but clicking Save does nothing—no error message, no confirmation, quantity stays at 12kg after refresh.\n\n' +
          'Steps to reproduce:\n' +
          '1. Log in as Manager (priya@urbanbistro.lk)\n' +
          '2. Go to POS → Inventory\n' +
          '3. Find "Coffee Beans Dark Roast" in the list (current quantity: 12kg)\n' +
          '4. Click Edit icon\n' +
          '5. Change quantity from 12 to 8\n' +
          '6. Click Save button → Nothing happens\n' +
          '7. Refresh page → Quantity still shows 12kg (change not saved)\n\n' +
          'This happens for all inventory items, not just Coffee Beans. I can create new inventory items successfully, but cannot edit existing quantities. Issue started today around 2 PM; was working fine yesterday.\n\n' +
          'Screenshots attached: [inventory-edit-screen.png, save-button-unresponsive.png]\n\n' +
          'Impact: Cannot track inventory depletion, will miss low-stock alerts, may run out of critical ingredients without warning.\n\n' +
          'Urgent: Please investigate. Workaround: manually tracking inventory in spreadsheet for now.\n\n' +
          '**Example Support Request (Bad - Avoid This):**\n' +
          'Subject: Not working\n\n' +
          'Body: The system is broken. Fix it ASAP.\n\n' +
          '(Support cannot help with this: no business name, no description, no steps, no timestamp, no contact info. Response will be delayed as support asks clarifying questions.)\n\n' +
          '**Payment & Billing Disputes:**\n' +
          '• Keep bank transfer receipts, PayPal transaction IDs, and Stripe confirmation emails until Subscription page shows "Verified" or "Paid" status\n' +
          '• If payment is not verified within stated timeframe (2 business days for bank transfers, immediate for online payments), contact support with: transaction ID, amount, date, uploaded receipt screenshot, and Subscription page screenshot showing pending status\n' +
          '• For incorrect billing amounts (charged Rs. 25,000 but Subscription said Rs. 20,000), provide: invoice/bill screenshot, actual charged amount with proof (bank statement), and explanation of expected vs. actual\n\n' +
          '**Expected Response Times:**\n' +
          '• Critical outages (cannot access POS, payment gateway down): Response within 2 hours, resolution target 4-8 hours\n' +
          '• High-priority (billing errors, missing features blocking operations): Response within 1 business day, resolution target 2-3 business days\n' +
          '• Medium-priority (minor bugs, feature clarifications, "how do I..." questions): Response within 2 business days, resolution varies\n' +
          '• Low-priority (feature requests, cosmetic issues): Acknowledged within 1 week, implementation varies (may be added to product roadmap)\n\n' +
          '**Self-Service Before Contacting Support:**\n' +
          'Before opening a support ticket, try these troubleshooting steps to resolve common issues faster:\n' +
          '• Refresh the browser page (Ctrl+F5 or Cmd+Shift+R for hard refresh)\n' +
          '• Clear browser cache and cookies, then log in again\n' +
          '• Try a different browser (if issue is in Chrome, test in Firefox or Safari)\n' +
          '• Check internet connection (can you load other websites? Is Wi-Fi stable?)\n' +
          '• Verify user role and permissions (does your role actually have access to the feature you are trying to use? Cashiers cannot edit menu items; that requires Manager role)\n' +
          '• Read this guide: Search for the feature or workflow in sections 1-14 to ensure you are following correct procedures\n' +
          '• Check notifications (bell icon): Is there an alert explaining the issue? For example, "Subscription expired" would explain why POS is locked\n\n' +
          'If these steps do not resolve the issue, proceed with contacting support using the detailed request format above.',
        tip: 'Document steps to reproduce POS issues (role, store, exact navigation path, timestamp) so support can respond faster. Generic reports like "POS is slow" or "Menu not working" are hard to diagnose; specific reports like "Manager role, Colombo store, POS → Menu → Edit Latte item, Save button unresponsive after changing price, occurred May 21 at 2:35 PM" get resolved quickly. Take screenshots or screen recordings whenever possible—visual evidence is worth a thousand words. Keep a log of recurring issues with dates and details so you can identify patterns and escalate persistent problems with data (for example, "Card payment gateway times out every Friday between 6-8 PM for the past 3 weeks").',
      },
    ],
    outcome: 'Your team runs with consistent configuration, disciplined shifts, and a clear path when something needs platform help.',
  },
];

export const FEATURE_MATRIX = [
  { area: 'Signup & trial', admin: '—', pos: '—', web: 'Apply, upload BR, choose plan' },
  { area: 'Subscription', admin: 'Pay, receipts, plan change (LKR or USD by region)', pos: '—', web: 'Sign in links' },
  { area: 'Branding', admin: 'Logo, colors, currency, business info', pos: 'Themed UI, currency on amounts', web: '—' },
  { area: 'Stores', admin: 'Create, billing for extras', pos: 'Store switcher', web: '—' },
  { area: 'Users', admin: 'Create, roles, store scope', pos: 'Role-based nav', web: '—' },
  { area: 'Menu & stock', admin: '—', pos: 'Menu, categories, inventory', web: '—' },
  { area: 'Register & kitchen', admin: 'Cashier sessions', pos: 'Orders, KDS, day-end', web: '—' },
  { area: 'Analytics', admin: 'Full analytics page', pos: 'Manager dashboard', web: 'This guide' },
  { area: 'Promotions', admin: '—', pos: 'Create / approve / apply', web: '—' },
  { area: 'Loyalty', admin: 'Add-on, config, customers', pos: 'Checkout, customers', web: '—' },
  { area: 'QR ordering', admin: 'Add-on subscribe', pos: 'Tables & QR', web: '—' },
  { area: 'Notifications', admin: 'Bell, email', pos: 'Bell', web: '—' },
  { area: 'Customers', admin: 'Customer list', pos: 'Search, attach at register', web: '—' },
];
