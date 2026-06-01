'use strict';

const { initNotificationBus, publishCheckinEvent, subscribeCheckinEvent } = require('../lib/notificationBus');

async function run() {
  console.log('--- Starting SSE Pub/Sub Verification ---');

  // Initialize the bus in in-process mode for testing
  const mockLogger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
  };
  await initNotificationBus(mockLogger);

  const sessionId = 'test-session-12345';
  const mockCustomer = {
    _id: 'cust-9876',
    name: 'Jane Doe',
    mobile: '+15555551234',
    email: 'jane@example.com',
  };

  let receivedMessage = null;

  // Subscribe to the check-in event
  const unsubscribe = subscribeCheckinEvent(sessionId, (message) => {
    receivedMessage = JSON.parse(message);
    console.log('[Subscriber] Received check-in message:', receivedMessage);
  });

  // Publish the check-in event
  console.log('[Publisher] Broadcasting check-in event...');
  publishCheckinEvent(sessionId, mockCustomer);

  // Wait a small moment to allow events to process (even though local EventEmitter is synchronous)
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify the customer data was broadcast and received
  if (receivedMessage && receivedMessage.type === 'CHECKIN_COMPLETE' && receivedMessage.customer.name === 'Jane Doe') {
    console.log('SSE pub/sub test: PASS');
  } else {
    console.error('SSE pub/sub test: FAIL', receivedMessage);
    process.exit(1);
  }

  unsubscribe();
  console.log('--- SSE Pub/Sub Verification Finished ---');
}

run().catch((err) => {
  console.error('Test Execution failed:', err);
  process.exit(1);
});
