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
          'From the Cafinity website, open Sign up and complete the business application. Enter accurate contact details, upload any required registration documents, and select the plan that matches how you want to bill (monthly or yearly).\n\n' +
          'Submit the form when everything is correct. You will not have admin or POS access until a platform administrator approves the application.',
        tip: 'Use the same email you want for the primary merchant admin account; approval messages and billing alerts go to this address.',
      },
      {
        heading: 'Wait for approval',
        body:
          'A platform administrator reviews your application and may contact you if anything is missing. When approved, you receive an email with sign-in instructions.\n\n' +
          'Your tenant is provisioned with a trial period and a default store so you can start configuration immediately after your first login.',
      },
      {
        heading: 'Sign in to the admin portal',
        body:
          'Use Sign in → Admin portal on the website with the email and password from your approval email. The dashboard shows trial days remaining or active subscription status.\n\n' +
          'From here, complete subscription payment, branding, and store setup before inviting staff to the POS.',
        tip: 'Bookmark the admin portal URL for billing and configuration tasks managers should not do on the register.',
      },
      {
        heading: 'Open the POS for staff',
        body:
          'Use Open POS from the admin sidebar, or Sign in → POS on the public website. Cashiers and kitchen staff sign in with accounts you create under Admin → Users.\n\n' +
          'Managers use the POS for menu, inventory, promotions, and the dashboard; merchant admins retain full control in the admin portal.',
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
          'Open Admin → Dashboard for a quick view of trial days left or active subscription. Open Admin → Subscription for the full breakdown: plan name, period, add-ons, extra stores, and payment history.\n\n' +
          'Use this page before every payment so the amount you send matches the displayed total.',
      },
      {
        heading: 'Pay by bank transfer (Sri Lanka)',
        body:
          'If your account shows LKR pricing, you can pay by bank transfer. On Subscription, confirm the plan and period shown, transfer the exact amount to the listed bank account, then enter the transaction reference and upload the receipt.\n\n' +
          'Submit the form and wait for verification. Until the payment is approved, treat the subscription as pending—do not assume access is extended until status updates.',
        tip: 'The payable total includes your base plan plus active add-ons and any extra stores—not the plan price alone.',
      },
      {
        heading: 'Pay online (Stripe or PayPal)',
        body:
          'Sri Lanka merchants can use Stripe for card payments or PayPal where shown on Subscription. International merchants use PayPal for USD plan payments.\n\n' +
          'Online payments are verified automatically; refresh the page or check notifications when the transaction completes.',
      },
      {
        heading: 'Schedule a plan change',
        body:
          'Use Change plan to switch between monthly and yearly billing or to move to a different tier at the end of the current period. After scheduling, the payment form defaults to the upcoming plan so you are not double-charged for the old and new plan in one period.\n\n' +
          'You will see the scheduled change on Subscription until it takes effect.',
      },
      {
        heading: 'Subscribe to add-ons',
        body:
          'Open Admin → Add-ons to enable optional features such as QR ordering or loyalty. The first charge is prorated to the days left in your current billing period; renewals align with your main plan cycle.\n\n' +
          'International merchants see USD add-on prices configured by the platform admin; Sri Lanka merchants see LKR add-on pricing. Confirm the currency and amount before paying.',
      },
      {
        heading: 'Pay for additional stores',
        body:
          'Your first store is included in the subscription. Each additional location is created on Admin → Stores and requires a prorated payment before the store is active.\n\n' +
          'Expect the extra-store line item on your next subscription breakdown after creation.',
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
          'On Admin → Branding & Settings, set business name, address, phone (required), and email. These fields print on receipts and may appear on guest-facing ordering surfaces.\n\n' +
          'Save after each change; incomplete contact details can block receipt compliance in some regions.',
      },
      {
        heading: 'Upload logo and choose colors',
        body:
          'Upload your logo and pick a theme preset or custom colors. The POS uses your palette in dark mode for headers, accents, and primary buttons.\n\n' +
          'Preview how contrast looks on a typical register screen—very light accent colors can be hard to read in bright venues.',
        tip: 'If you rebrand later, update colors here first; staff devices pick up the new theme on refresh without reinstalling the app.',
      },
      {
        heading: 'Set currency',
        body:
          'Choose the currency code and symbol your business uses day to day. This single setting drives how every monetary value is labeled in the admin portal and POS.\n\n' +
          'Change currency only before go-live or during a planned cutover; historical analytics and open orders assume the currency in effect when they were created.',
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
          'After approval, you typically have one default store. Open Admin → Stores to confirm its name, code, and address.\n\n' +
          'Edit details in the side drawer if anything was placeholder during provisioning.',
      },
      {
        heading: 'Add an extra location',
        body:
          'Click to create a new store and enter name, code, address, and payment methods accepted at that site. The flow prompts for prorated payment before the store is saved as active.\n\n' +
          'Complete payment the same way as subscription (bank receipt or online, depending on your region).',
        tip: 'Use short, unique store codes—they appear in exports and help managers spot the wrong store quickly.',
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
          'Go to Admin → Users and create an account for each person who needs POS or admin access. Use their work email where possible so password resets reach them.\n\n' +
          'Avoid shared logins; separate accounts preserve who opened sessions and approved sensitive actions.',
      },
      {
        heading: 'Assign roles',
        body:
          'Cashier — register, payments, and order board. Kitchen — kitchen display and item status. Manager — menu, inventory, promotions, dashboard, and many operational reports. Merchant admin — full admin portal including billing and branding.\n\n' +
          'Give the narrowest role that still lets the person do their job; promote to manager only when they need configuration access.',
        tip: 'Too many merchant admin accounts increases billing and security risk—keep admin portal access to owners and trusted supervisors.',
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
    summary: 'Categories, items, combos, availability, and stock in the POS manager area.',
    overview:
      'The menu powers the register grid, kitchen routing, and guest QR menu. Managers maintain categories and items in the POS under Menu (not in the admin portal), keeping pricing close to the people who run service.\n\n' +
      'Items support categories, prices, optional combos, images, and per-store availability. Mark items unavailable when you are out of stock so cashiers cannot sell what the kitchen cannot make.\n\n' +
      'Inventory tracking complements the menu with stock levels and supplier records for purchasing discipline—use it when low-stock awareness matters to your operation.',
    prerequisites: [
      'Manager (or merchant admin) access to the POS',
      'Active store selected in the POS',
      'Category structure planned (for example drinks, food, retail)',
      'Price list and any combo rules ready to enter',
    ],
    steps: [
      {
        heading: 'Create categories',
        body:
          'In POS → Menu (manager), add categories that match how you want items grouped on the register and QR menu.\n\n' +
          'Order categories logically for fast cashier taps during rush periods—popular categories first.',
      },
      {
        heading: 'Add menu items',
        body:
          'Create items with name, price, category, and optional images. Link combo or modifier behavior as your setup supports.\n\n' +
          'Set availability per store when the same item differs between locations.',
        tip: 'Enter prices in the currency configured in branding; mismatched expectations usually mean branding was not set before menu build.',
      },
      {
        heading: 'Manage availability',
        body:
          'Toggle items available or unavailable without deleting them. Unavailable items stay in the catalog for later but disappear from the sellable grid.\n\n' +
          'Review availability at open and after 86 incidents so the register matches the kitchen.',
      },
      {
        heading: 'Track inventory (optional)',
        body:
          'Use inventory tools in the manager area to record stock levels and suppliers. Update counts when deliveries arrive or when counts drift.\n\n' +
          'Inventory supports awareness; it does not replace physical stock checks in the walk-in.',
      },
    ],
    outcome: 'Your menu is categorized, priced, and available per store so cashiers and QR guests order only what you can fulfill.',
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
          'Cashiers open a session when starting a shift and declare opening float if your process requires it. Orders and cash movements attach to that session for reconciliation.\n\n' +
          'Do not share an open session between people—each cashier should use their own login and session.',
      },
      {
        heading: 'Take orders on the register',
        body:
          'Register → New order: add items, choose order type, assign tables if applicable, and send to kitchen. Apply promotions at payment when eligible.\n\n' +
          'Complete payment to close the ticket; partial or unpaid tickets remain on the order board.',
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
          'Cashiers close sessions at shift end with counted cash. Managers review sessions on Admin → Cashier sessions or POS → Cash sessions.\n\n' +
          'Run the day-end report for totals, discounts, and promotion usage for that calendar day and store.',
        tip: 'Resolve voids and manager approvals before day-end so totals match what leadership expects.',
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
          'Open Admin → Add-ons, enable QR Ordering, and complete payment if prompted. Confirm the add-on shows active on Subscription before configuring tables.\n\n' +
          'International accounts pay USD add-on pricing; Sri Lanka accounts see LKR pricing as configured by the platform.',
      },
      {
        heading: 'Create tables and QR codes',
        body:
          'In POS → Café tables & QR, create each table with a label staff recognize. Generate, download, or print QR codes linked to the guest ordering URL for that table.\n\n' +
          'Place codes where guests naturally scan them; test one table yourself before rolling out floor-wide.',
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
      'Promotions reduce price or change basket behavior at checkout across five distinct types: **percentage discounts**, **flat amount discounts**, **bundle deals**, **Buy X Get Y offers**, and **flat-price specials**. Managers typically create promotions in the POS where they understand daypart and menu constraints.\n\n' +
      'Each promotion type serves different marketing goals—use percentage or flat discounts for broad sale events, bundles for meal deals, Buy X Get Y for inventory rotation, and flat pricing for happy hour specials.\n\n' +
      'Some venues require merchant admin approval before a promotion goes live. Use approval workflows so discounted selling is deliberate, not accidental. Applied discounts appear on receipts and feed analytics so you can measure promotion lift versus margin.',
    prerequisites: [
      'Manager or merchant admin POS access',
      'Clear rules for who may create versus approve promotions',
      'Menu items and categories stable enough to target promotions',
      'Understanding of margin and ideal discount depth per promotion type',
    ],
    steps: [
      {
        heading: 'Choose the right promotion type',
        body:
          '**Percentage discount** — Take a percent off eligible items or the entire order. Example: "20% off all beverages" or "15% off orders over $50".\n\n' +
          '**Flat discount** — Subtract a fixed amount from eligible items or the total. Example: "$5 off any sandwich" or "$10 off orders over $40".\n\n' +
          '**Bundle deal** — Sell a predefined set of items together at a special price. Example: "Burger + Fries + Drink for $12" (normally $17).\n\n' +
          '**Buy X Get Y** — When a customer buys X of one product, they get Y of another (or the same) product free. Example: "Buy 2 coffees, get 1 free" or "Buy any entree, get a dessert free".\n\n' +
          '**Flat price** — Offer selected items at a single fixed price during the promotion period. Example: "All pastries $3 each during morning hours" or "Any large pizza $15 this weekend".',
        tip: 'Pick bundle deals when you want to move specific combos; use percentage discounts for store-wide sales; use Buy X Get Y to clear slow movers or reward repeat visits.',
      },
      {
        heading: 'Create a percentage discount promotion',
        body:
          '**Step 1** — Open Admin → Promotions (or POS → Promotions if manager), then click Create promotion.\n\n' +
          '**Step 2** — Name: "Weekend Beverage Sale", Description: "20% off all drinks Saturday and Sunday".\n\n' +
          '**Step 3** — Type: Percentage discount. Discount percent: 20.\n\n' +
          '**Step 4** — Scope: Select "Beverages" category (or pick specific drink items if you want narrower targeting).\n\n' +
          '**Step 5** — Dates: Start date Saturday, end date Sunday. Active: Yes (or submit for approval).\n\n' +
          '**Step 6** — Optional: Min order amount if you only want the discount on orders over a threshold (leave blank for no minimum).\n\n' +
          '**Step 7** — Save. If approval is required, the promotion enters pending state; merchant admins approve it on Admin → Promotions.\n\n' +
          '**Example outcome**: A customer ordering a $6 latte sees $4.80 at checkout (20% off). Receipt shows "Weekend Beverage Sale: -$1.20".',
      },
      {
        heading: 'Create a flat discount promotion',
        body:
          '**Step 1** — Create promotion, name it "Sandwich Special", description "$3 off any sandwich".\n\n' +
          '**Step 2** — Type: Flat discount. Discount amount: 3.\n\n' +
          '**Step 3** — Scope: Select the "Sandwiches" category or individual sandwich items.\n\n' +
          '**Step 4** — Dates: Set start and end dates for how long the deal runs.\n\n' +
          '**Step 5** — Optional: Min order amount (e.g., 15) if you only want the $3 off when the order total is at least $15.\n\n' +
          '**Step 6** — Save and approve if needed.\n\n' +
          '**Example outcome**: A $10 turkey sandwich is sold for $7. Receipt line: "Sandwich Special: -$3.00".',
        tip: 'Use max discount amount to cap the flat discount on very expensive items if you apply it order-wide instead of per-item.',
      },
      {
        heading: 'Create a bundle deal promotion',
        body:
          '**Step 1** — Create promotion, name "Lunch Combo", description "Burger + Fries + Soda for $12".\n\n' +
          '**Step 2** — Type: Bundle deal.\n\n' +
          '**Step 3** — Add bundle items:\n  • Burger (quantity 1)\n  • Fries (quantity 1)\n  • Soda (quantity 1)\n\n' +
          '**Step 4** — Bundle price: 12. (Assume individual prices total $17—customer saves $5.)\n\n' +
          '**Step 5** — Dates: Choose weekdays for lunch rush or all week if it\'s a permanent combo.\n\n' +
          '**Step 6** — Save. Cashiers apply "Lunch Combo" at checkout when a customer orders those exact items.\n\n' +
          '**Example outcome**: Order shows Burger ($8), Fries ($4), Soda ($5). Promotion "Lunch Combo" reduces total to $12. Receipt: "Lunch Combo bundle: $12.00 (saved $5.00)".',
        tip: 'Bundles work best when the items are frequently ordered together—avoid obscure combos guests rarely want.',
      },
      {
        heading: 'Create a Buy X Get Y promotion',
        body:
          '**Step 1** — Create promotion, name "Coffee Loyalty", description "Buy 2 coffees, get 1 free".\n\n' +
          '**Step 2** — Type: Buy X Get Y.\n\n' +
          '**Step 3** — Buy product: Select "Coffee" from menu. Buy quantity: 2.\n\n' +
          '**Step 4** — Free product: Select "Coffee" again (same item). Free quantity: 1.\n\n' +
          '**Step 5** — Dates: Ongoing or limited-time.\n\n' +
          '**Step 6** — Save. When a customer orders 3 coffees, they pay for 2 and get the third free.\n\n' +
          '**Example outcome**: Three $4 coffees ordered = $12 total. Promotion applies: customer pays $8, gets 1 free ($4 discount). Receipt: "Coffee Loyalty: -$4.00".\n\n' +
          '**Variation example**: "Buy any entree, get dessert free"—set buy product to any entree item or category, free product to any dessert. Great for clearing dessert inventory.',
        tip: 'This type drives repeat visits and upsell—promote it visibly so guests know to order the threshold quantity.',
      },
      {
        heading: 'Create a flat-price promotion',
        body:
          '**Step 1** — Create promotion, name "Happy Hour Pizzas", description "Any large pizza $15, 4–6 PM".\n\n' +
          '**Step 2** — Type: Flat price.\n\n' +
          '**Step 3** — Scope: Select all large pizza items (Margherita, Pepperoni, Veggie, etc.) or the "Large Pizzas" category.\n\n' +
          '**Step 4** — Flat price: 15. (Normally pizzas range $18–$22; now all are $15.)\n\n' +
          '**Step 5** — Dates: Every weekday from 4 PM to 6 PM (set start/end dates to cover the promotion window).\n\n' +
          '**Step 6** — Save. During happy hour, any selected pizza rings up at $15 regardless of original price.\n\n' +
          '**Example outcome**: Customer orders a $22 Deluxe Pizza at 5 PM. Register applies "Happy Hour Pizzas" and charges $15. Receipt: "Happy Hour Pizzas: final price $15.00 (saved $7.00)".',
        tip: 'Flat-price promotions are powerful for evening or slow-hour traffic—guests perceive high value when premium items drop to one low price.',
      },
      {
        heading: 'Advanced options: Min order, max discount, loyalty tiers',
        body:
          '**Min order amount** — Require a minimum basket total before the promotion applies. Example: "$10 off orders over $50" prevents tiny orders from getting disproportionate discounts.\n\n' +
          '**Max discount amount** — Cap how much a percentage or flat discount can reduce the bill. Example: "20% off, max $20 discount" ensures very large orders don\'t get excessive reductions.\n\n' +
          '**Min tier level (loyalty)** — Restrict the promotion to customers at or above a loyalty tier. Example: "Gold members only: 25% off" rewards your best guests and encourages tier advancement.\n\n' +
          '**Store vs tenant scope** — Tenant-wide promotions apply at all locations; store-specific promotions target one site. Use store scope for local events or branch-specific inventory needs.\n\n' +
          '**Active toggle** — Control whether the promotion is live without deleting it. Turn off after a campaign ends, then reactivate for the next cycle without rebuilding rules.',
      },
      {
        heading: 'Approve or reject (when required)',
        body:
          'Merchant admins review submissions on Admin → Promotions (filter by pending). Check that discount depth, scope, and dates align with business goals and margin targets.\n\n' +
          '**Approve** — Promotion goes live and cashiers can apply it at checkout immediately.\n\n' +
          '**Reject** — Provide a reason ("Discount too high for margin" or "Dates conflict with existing sale") so the manager can revise and resubmit.\n\n' +
          'Consistent approval discipline prevents margin erosion from overly generous or conflicting promotions.',
      },
      {
        heading: 'Apply at checkout',
        body:
          'Cashiers attach eligible promotions during payment on the register. The promotion list shows only active deals valid for the current date, store, and (if applicable) customer tier.\n\n' +
          'Select the promotion name, confirm the discount or bundle price appears, then complete payment. The discount breakdown prints on the receipt when configured.\n\n' +
          'If a promotion does not appear in the list, verify: dates are current, store scope matches active store, min order threshold is met, applicable items are in the cart, and approval status is approved.',
        tip: 'Train cashiers to recognize promotion names—"Happy Hour Pizzas" only works 4–6 PM; applying it at 8 PM will fail validation.',
      },
      {
        heading: 'Monitor performance and adjust',
        body:
          'Use Admin → Analytics or POS → Dashboard to review promotion usage: how many times applied, total discount given, revenue impact, and which items sold under each deal.\n\n' +
          'Compare sales during promotion periods versus baseline to measure lift. If a bundle isn\'t moving, adjust the price or swap an item; if a percentage discount costs too much margin, lower the percent or add a min order threshold.\n\n' +
          'Turn off underperforming promotions and iterate—your menu and guest behavior will guide what deals resonate.',
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
          'Subscribe on Admin → Add-ons, complete payment if required, then open Admin → Loyalty admin. Confirm the program is marked active before announcing it to guests.\n\n' +
          'Without the add-on, loyalty menus and redemption stay hidden.',
      },
      {
        heading: 'Configure tiers and rewards',
        body:
          'Set earning rules, tier thresholds, and redeemable rewards (points-based or automatic perks). Use simple thresholds first—you can refine after you see real earn rates.\n\n' +
          'Document staff-facing rules for when to offer signup versus when to skip the line.',
      },
      {
        heading: 'Maintain customer profiles',
        body:
          'Use Admin → Customers and POS → Customers to search, create, and update profiles. Fix misspelled phone or email early so points consolidate on one record.\n\n' +
          'Managers can adjust balances when policy allows; log reasons in your internal ops notes.',
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
          'Open Admin → Analytics, pick a store and date range, then review revenue, category mix, promotion impact, daily order volume, top selling items, and recent orders.\n\n' +
          'Compare periods of equal length (for example two full weeks) before drawing conclusions about trends.',
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
          'Click the bell in the admin header or POS navigation to open the notification list. Read each item and follow links to Subscription, approvals, or other targets when offered.\n\n' +
          'Mark items read as you act so the team knows what is still outstanding.',
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
          'Add customers with name and contact fields staff can verify at the counter. Search by phone or email before creating duplicates.\n\n' +
          'Merge or retire duplicate profiles when you find them—split points frustrate guests.',
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
          'Keep the correct store selected, monitor kitchen and order boards, and use QR/table tools only when the add-on is active. Attach loyalty customers before payment when the program is on.\n\n' +
          'Escalate repeated payment or sync issues to a merchant admin rather than workaround pricing.',
      },
      {
        heading: 'End of day',
        body:
          'Close cashier sessions with counted cash, review manager dashboard or admin analytics for the day, and clear void or approval queues.\n\n' +
          'Note anomalies (large discounts, missing sessions) while facts are fresh.',
      },
      {
        heading: 'Get support',
        body:
          'Use the website contact form for platform defects or billing disputes. Keep bank transfer receipts until Subscription shows verified payment.\n\n' +
          'Document steps to reproduce POS issues (role, store, time) so support can respond faster.',
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
